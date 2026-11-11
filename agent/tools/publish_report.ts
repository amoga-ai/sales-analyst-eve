// agent/tools/publish_report.ts: Approval-gated step; Eve asks a person before this runs.
import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

export default defineTool({
  description: "Approve and publish the daily review for a day. Requires a person to approve first.",
  inputSchema: z.object({
    day: z.string().describe("The review day, as YYYY-MM-DD"),
  }),
  approval: always(),
  async execute({ day }) {
    return { day, message: "Report approved. Saving and publishing are not connected yet." };
  },
});