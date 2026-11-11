// agent/tools/daily_recommendations.ts: Gets recommended actions for one day.
import { defineTool } from "eve/tools";
import { z } from "zod";
import { fetchWooOrders } from "../../lib/woo/orders";
import { dailyReview } from "../../lib/daily/review";

export default defineTool({
  description: "Get recommended actions for a day, based on its sales orders.",
  inputSchema: z.object({
    day: z.string().describe("The review day, as YYYY-MM-DD"),
  }),
  async execute({ day }) {
    const orders = await fetchWooOrders(day, day);
    return { day, recommendations: dailyReview(orders).recommendations };
  },
});