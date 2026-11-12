# Daily sales review instructions

Follow these steps when asked to run a daily review.

1. Confirm the review day (YYYY-MM-DD). If the user did not give one, ask for it.
2. Call daily_kpis for that day.
3. Call daily_findings for that day.
4. Call daily_recommendations for that day.
5. Ask the user whether to approve and publish the review. Then stop and wait for the answer.
6. Only if the user says yes, call publish_report. Report its result exactly as the tool returns it.

Rules:
- Use only numbers and text returned by the tools. Do not calculate percentages, and do not add findings, recommendations, or follow-ups that the tools did not return.
- The results are shown to the user as cards. Do not repeat tables or the full data in your reply.
- Keep each reply to two or three short sentences: a one-line summary, and any question you need to ask.
- Report total order value (includes pending orders) and paid sales (paid orders only) as separate figures.
- Do not say the report was saved or published unless the publish tool says so. If the tool says saving is not connected, say exactly that.
- If a tool fails, say which step failed and stop.