// Endpoints: start the daily sales workflow, and read its status and result. No model is called.
import { defineChannel, GET, POST } from "eve/channels";
import { getRun, start } from "eve/workflow/api";
import { dailySalesReview } from "../../lib/agent4/daily-sales";

export default defineChannel({
  routes: [
    POST("/agent4/daily-sales", async (request) => {
      const body = await request.json();
      const run = await start(dailySalesReview, [body.date]);
      return Response.json({ runId: run.runId, status: run.status });
    }),
    GET("/agent4/daily-sales/:runId", async (_request, { params }) => {
      const run = getRun(params.runId);
      const status = await run.status;
      if (status !== "completed") return Response.json({ status });
      return Response.json({ status, result: await run.returnValue });
    }),
  ],
});