// agent/tools/make_document.ts: Builds a Word or Excel file for one day's sales review and returns it as base64, so the chat app can save it.
import { defineTool } from "eve/tools";
import { z } from "zod";
import ExcelJS from "exceljs";
import { Document, Packer, Paragraph, Table, TableRow, TableCell, HeadingLevel, WidthType } from "docx";
import { fetchWooOrders } from "../../lib/woo/orders";
import { dailyReview } from "../../lib/daily/review";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function cell(text: string | number) {
  return new TableCell({ children: [new Paragraph(String(text))] });
}

export default defineTool({
  description: "Make a Word or Excel file with one day's sales review. Returns the file so the chat app can save it.",
  inputSchema: z.object({
    day: z.string().describe("The review day, as YYYY-MM-DD"),
    format: z.enum(["xlsx", "docx"]).describe("xlsx for Excel, docx for Word"),
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
    const products: { name: string; sku: string; units: number; sales: number }[] = review.products ?? [];
    const fileName = `daily-sales-review-${day}.${format}`;

    if (format === "xlsx") {
      const wb = new ExcelJS.Workbook();
      const summary = wb.addWorksheet("Summary");
      summary.addRow(["Figure", "Value"]);
      figures.forEach((row) => summary.addRow(row));
      const sheet = wb.addWorksheet("Products");
      sheet.addRow(["Product", "SKU", "Units", "Sales"]);
      products.forEach((p) => sheet.addRow([p.name, p.sku, p.units, p.sales]));
      const buffer = await wb.xlsx.writeBuffer();
      return { fileName, mimeType: XLSX_TYPE, base64: Buffer.from(buffer).toString("base64") };
    }

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
    const buffer = await Packer.toBuffer(doc);
    return { fileName, mimeType: DOCX_TYPE, base64: Buffer.from(buffer).toString("base64") };
  },
});