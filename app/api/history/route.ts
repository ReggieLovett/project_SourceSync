import { listHistory } from "../../../lib/history";
import { errorResponse } from "../../../lib/http";
import type { HistoryListResponse } from "../../../lib/types";

// Always read the folder fresh; the list changes with every save.
export const dynamic = "force-dynamic";

/** → { entries: HistorySummary[] }, most recently updated first */
export async function GET(): Promise<Response> {
  try {
    const body: HistoryListResponse = { entries: await listHistory() };
    return Response.json(body);
  } catch (error) {
    return errorResponse(error);
  }
}
