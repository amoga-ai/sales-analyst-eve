// Workflow with plain code steps, no model calls. Each "use step" function is one fixed step.
export async function dailySalesReview(date: string) {
  "use workflow";
  const sales = await fetchSales(date);
  const summary = await summarize(sales);
  return { status: "completed", date, summary };
}

// Step: fetch data. Replace the example rows with your real API call.
async function fetchSales(date: string) {
  "use step";
  return [{ amount: 100 }, { amount: 250 }];
}

// Step: plain calculation, no AI.
async function summarize(sales: { amount: number }[]) {
  "use step";
  return { total: sales.reduce((sum, s) => sum + s.amount, 0), orders: sales.length };
}