// agent/tools/daily_findings.ts: Gets trend findings for one day, compared with the day before and the same day last week.
import { defineTool } from "eve/tools";
import { z } from "zod";
import { fetchWooOrders } from "../../lib/woo/orders";
import { shiftDay } from "../../lib/daily/dates";
import { dailyReview, trendFindings } from "../../lib/daily/review";

export default defineTool({
  description:
    "Get trend findings for a day, compared with the day before and the same day last week.",
  inputSchema: z.object({
    day: z.string().describe("The review day, as YYYY-MM-DD"),
  }),
  async execute({ day }) {
    const [orders, dayBefore, lastWeek] = await Promise.all([
      fetchWooOrders(day, day),
      fetchWooOrders(shiftDay(day, -1), shiftDay(day, -1)),
      fetchWooOrders(shiftDay(day, -7), shiftDay(day, -7)),
    ]);
    return trendFindings(
      dailyReview(orders),
      dailyReview(dayBefore),
      dailyReview(lastWeek)
    );
  },
});