// agent/tools/daily_kpis.ts: Gets sales KPIs for one day, compared with the day before and the same day last week.
import { defineTool } from "eve/tools";
import { z } from "zod";
import { fetchWooOrders } from "../../lib/woo/orders";
import { shiftDay } from "../../lib/daily/dates";
import { dailyReview } from "../../lib/daily/review";

export default defineTool({
  description:
    "Get sales KPIs for a day, compared with the day before and the same day last week.",
  inputSchema: z.object({
    day: z.string().describe("The review day, as YYYY-MM-DD"),
  }),
  async execute({ day }) {
    const [orders, dayBefore, lastWeek] = await Promise.all([
      fetchWooOrders(day, day),
      fetchWooOrders(shiftDay(day, -1), shiftDay(day, -1)),
      fetchWooOrders(shiftDay(day, -7), shiftDay(day, -7)),
    ]);
    return {
      day,
      today: dailyReview(orders),
      dayBefore: dailyReview(dayBefore),
      lastWeek: dailyReview(lastWeek),
    };
  },
});