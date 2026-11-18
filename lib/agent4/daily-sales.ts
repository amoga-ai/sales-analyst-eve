// Workflow with plain code steps and no model calls. It reads the same WooCommerce orders as the Eve KPI tool.
import { fetchWooOrders, type WooOrder } from "../woo/orders";

export async function dailySalesReview(date: string) {
  "use workflow";
  const orders = await fetchSales(date);
  const summary = await summarize(orders);
  const topOrders = await topTenOrders(orders);
  return { status: "completed", date, summary, topOrders };
}

// Step: load the day's orders from WooCommerce.
async function fetchSales(date: string) {
  "use step";
  return await fetchWooOrders(date, date);
}

// Step: plain totals, no AI.
async function summarize(orders: { total: string }[]) {
  "use step";
  return {
    total: orders.reduce((sum, o) => sum + Number(o.total), 0),
    orders: orders.length,
  };
}

// Step: the 10 largest orders by total, as plain rows. No AI.
async function topTenOrders(orders: WooOrder[]) {
  "use step";
  return orders
    .map((o) => ({
      id: o.id,
      date: o.date_created.slice(0, 10),
      status: o.status,
      total: Number(o.total),
      currency: o.currency,
      payment: o.payment_method_title || "Unknown",
      items: o.line_items.reduce((s, li) => s + li.quantity, 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}