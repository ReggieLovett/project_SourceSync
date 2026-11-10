import { LIMITS } from "../../../../lib/config";
import { assertHistoryId, deleteHistoryEntry, getHistoryEntry, saveHistoryEntry } from "../../../../lib/history";
import { errorResponse, readJson } from "../../../../lib/http";

type Context = { params: Promise<{ id: string }> };

/** → HistoryEntry (the full saved conversation or check) */
export async function GET(_request: Request, { params }: Context): Promise<Response> {
  try {
    const { id } = await params;
    return Response.json(await getHistoryEntry(id));
  } catch (error) {
    return errorResponse(error);
  }
}

/** HistorySaveRequest → HistoryEntry. Creates the item, or replaces it and keeps its createdAt. */
export async function PUT(request: Request, { params }: Context): Promise<Response> {
  try {
    const { id } = await params;
    assertHistoryId(id);
    const body = await readJson(request, LIMITS.historyEntryBytes);
    return Response.json(await saveHistoryEntry(id, body));
  } catch (error) {
    return errorResponse(error);
  }
}

/** → { deleted: true, id } */
export async function DELETE(_request: Request, { params }: Context): Promise<Response> {
  try {
    const { id } = await params;
    await deleteHistoryEntry(id);
    return Response.json({ deleted: true, id });
  } catch (error) {
    return errorResponse(error);
  }
}
