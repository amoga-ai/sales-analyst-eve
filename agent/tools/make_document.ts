// agent/tools/make_document.ts: Builds a CSV, Excel, Word, PowerPoint, or PDF file for one day's sales review and returns it as base64, so the chat app can save it.
import { defineTool } from "eve/tools";
import { z } from "zod";
import ExcelJS from "exceljs";
import { Document, Packer, Paragraph, Table, TableRow, TableCell, HeadingLevel, WidthType } from "docx";
import PptxGenJS from "pptxgenjs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { fetchWooOrders } from "../../lib/woo/orders";
import { dailyReview } from "../../lib/daily/review";

const MIME = {
    csv: "text/csv",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    pdf: "application/pdf",
} as const;

type Product = { name: string; sku: string; units: number; sales: number };

function cell(text: string | number) {
    return new TableCell({ children: [new Paragraph(String(text))] });
}

// Escapes one CSV cell: wraps it in quotes when it has a comma, quote, or line break.
function csvCell(value: string | number) {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export default defineTool({
    description:
        "Make a CSV, Excel, Word, PowerPoint, or PDF file with one day's sales review. Returns the file so the chat app can save it.",
    inputSchema: z.object({
        day: z.string().describe("The review day, as YYYY-MM-DD"),
        format: z.enum(["csv", "xlsx", "docx", "pptx", "pdf"]).describe("csv, xlsx for Excel, docx for Word, pptx for PowerPoint, pdf for PDF"),
    }),
    async execute({ day, format }) {
        const review: any = dailyReview(await fetchWooOrders(day, day));
        const k = review.kpis;
        const figures: [string, string | number][] = [
            ["Total orders", k.totalOrders],
            ["Paid orders", k.paidOrders],
            ["Total order value", k.totalValue],
            ["Paid sales", k.paidSales],
            ["Average order value", k.averageOrderValue],
            ["Products sold", k.productsSold],
        ];
        const products: Product[] = review.products ?? [];
        const fileName = `daily-sales-review-${day}.${format}`;
        const base = (bytes: any) => ({
            fileName,
            mimeType: MIME[format],
            base64: Buffer.from(bytes).toString("base64"),
        });

        if (format === "csv") {
            const lines = [["Product", "SKU", "Units", "Sales"], ...products.map((p) => [p.name, p.sku, p.units, p.sales])];
            const text = "\uFEFF" + lines.map((row) => row.map(csvCell).join(",")).join("\n");
            return base(new TextEncoder().encode(text));
        }

        if (format === "xlsx") {
            const wb = new ExcelJS.Workbook();
            const summary = wb.addWorksheet("Summary");
            summary.addRow(["Figure", "Value"]);
            figures.forEach((row) => summary.addRow(row));
            const sheet = wb.addWorksheet("Products");
            sheet.addRow(["Product", "SKU", "Units", "Sales"]);
            products.forEach((p) => sheet.addRow([p.name, p.sku, p.units, p.sales]));
            return base(await wb.xlsx.writeBuffer());
        }

        if (format === "docx") {
            const doc = new Document({
                sections: [
                    {
                        children: [
                            new Paragraph({ text: `Daily Sales Review, ${day}`, heading: HeadingLevel.TITLE }),
                            new Table({
                                width: { size: 100, type: WidthType.PERCENTAGE },
                                rows: [
                                    new TableRow({ children: [cell("Figure"), cell("Value")] }),
                                    ...figures.map(([label, value]) => new TableRow({ children: [cell(label), cell(value)] })),
                                ],
                            }),
                            new Paragraph({ text: "Products", heading: HeadingLevel.HEADING_2 }),
                            new Table({
                                width: { size: 100, type: WidthType.PERCENTAGE },
                                rows: [
                                    new TableRow({ children: [cell("Product"), cell("SKU"), cell("Units"), cell("Sales")] }),
                                    ...products.map((p) =>
                                        new TableRow({ children: [cell(p.name), cell(p.sku), cell(p.units), cell(p.sales)] }),
                                    ),
                                ],
                            }),
                        ],
                    },
                ],
            });
            return base(await Packer.toBuffer(doc));
        }

        if (format === "pptx") {
            const pptx = new PptxGenJS();
            const slide = pptx.addSlide();
            slide.addText(`Daily Sales Review, ${day}`, { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 26, bold: true });
            slide.addTable(
                [[{ text: "Figure" }, { text: "Value" }], ...figures.map(([label, value]) => [{ text: label }, { text: String(value) }])],
                { x: 0.5, y: 1.3, w: 9, fontSize: 14 },
            );
            const productSlide = pptx.addSlide();
            productSlide.addText("Products", { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 26, bold: true });
            productSlide.addTable(
                [
                    [{ text: "Product" }, { text: "SKU" }, { text: "Units" }, { text: "Sales" }],
                    ...products.map((p) => [{ text: p.name }, { text: p.sku }, { text: String(p.units) }, { text: String(p.sales) }]),
                ],
                { x: 0.5, y: 1.3, w: 9, fontSize: 14 },
            );
            const bytes = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
            return base(bytes);
        }

        // PDF: a plain page with the figures and the product list.
        const pdf = await PDFDocument.create();
        const font = await pdf.embedFont(StandardFonts.Helvetica);
        const page = pdf.addPage([595, 842]);
        let y = 800;
        const line = (text: string, size = 11) => {
            page.drawText(text, { x: 50, y, size, font });
            y -= size + 8;
        };
        line(`Daily Sales Review, ${day}`, 18);
        y -= 6;
        figures.forEach(([label, value]) => line(`${label}: ${value}`));
        y -= 10;
        line("Products", 14);
        products.forEach((p) => line(`${p.name} (${p.sku}): ${p.units} units, ${p.sales}`));
        return base(await pdf.save());
    },
});