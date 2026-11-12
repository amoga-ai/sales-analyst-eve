// Workflow with plain code steps and no model calls. It reads the same WooCommerce orders as the Eve KPI tool.
import { fetchWooOrders } from "../woo/orders";

export async function dailySalesReview(date: string) {
  "use workflow";
  const orders = await fetchSales(date);
  const summary = await summarize(orders);
  return { status: "completed", date, summary };
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