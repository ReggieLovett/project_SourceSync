"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest, errorMessage } from "../../lib/api-client";
import type { HistoryEntry, HistoryListResponse, HistorySummary } from "../../lib/types";
import { formatWhen, plural, VerdictLabel } from "./CheckResultView";
import { useRequest } from "./hooks";

/**
 * Saved conversations and checks. The list reloads each time the mode is shown,
 * so items saved in Chat or the checker appear without a manual refresh.
 */
export default function SavedHistory({
  hidden,
  onOpen,
}: {
  hidden: boolean;
  onOpen: (entry: HistoryEntry) => void;
}) {
  const [entries, setEntries] = useState<HistorySummary[] | null>(null);
  const [error, setError] = useState("");
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const { busy, run } = useRequest();

  const refresh = useCallback(async () => {
    try {
      const body = await run((signal) => apiRequest<HistoryListResponse>("/api/history", { signal }));
      setEntries(body.entries);
      setError("");
    } catch (failure) {
      if (failure instanceof Error && failure.name === "AbortError") return;
      setError(errorMessage(failure));
    }
  }, [run]);

  useEffect(() => {
    if (hidden) return;
    setConfirming(null);
    void refresh();
  }, [hidden, refresh]);

  async function open(id: string) {
    setWorking(id);
    setRowError(null);
    try {
      onOpen(await apiRequest<HistoryEntry>(`/api/history/${id}`, { method: "GET" }));
    } catch (failure) {
      setRowError({ id, message: errorMessage(failure) });
    } finally {
      setWorking(null);
    }
  }

  async function remove(id: string) {
    setWorking(id);
    setRowError(null);
    try {
      await apiRequest(`/api/history/${id}`, { method: "DELETE" });
      setEntries((current) => current?.filter((entry) => entry.id !== id) ?? null);
      setConfirming(null);
    } catch (failure) {
      setRowError({ id, message: errorMessage(failure) });
    } finally {
      setWorking(null);
    }
  }

  const conversations = entries?.filter((entry) => entry.kind === "conversation") ?? [];
  const checks = entries?.filter((entry) => entry.kind === "check") ?? [];

  function actions(entry: HistorySummary) {
    const disabled = working !== null;
    if (confirming === entry.id) {
      return (
        <p data-role="history-actions">
          <small>Delete permanently?</small>
          <button type="button" data-role="danger" disabled={disabled} onClick={() => void remove(entry.id)}>
            Delete
          </button>
          <button type="button" disabled={disabled} onClick={() => setConfirming(null)}>Keep</button>
        </p>
      );
    }
    return (
      <p data-role="history-actions">
        <button type="button" disabled={disabled} aria-label={`Open “${entry.title}”`} onClick={() => void open(entry.id)}>
          {working === entry.id ? "Opening…" : "Open"}
        </button>
        <button type="button" disabled={disabled} aria-label={`Delete “${entry.title}”`} onClick={() => setConfirming(entry.id)}>
          Delete
        </button>
      </p>
    );
  }

  function row(entry: HistorySummary) {
    return (
      <li key={entry.id}>
        <p data-role="history-title">{entry.title}</p>
        {entry.kind === "conversation" ? (
          <p data-role="history-meta">
            <small>
              {formatWhen(entry.updatedAt)} · {plural(entry.messageCount, "message")} ·{" "}
              {entry.fileName ? `From ${entry.fileName}` : "No document"}
            </small>
          </p>
        ) : (
          <>
            <p data-role="history-meta">
              <small>
                {formatWhen(entry.createdAt)} ·{" "}
                {entry.faithfulness === null ? "No factual claims" : `${entry.faithfulness}% faithful`} ·{" "}
                {entry.strictnessMode ? "Healthcare Strictness" : "Standard"}
              </small>
            </p>
            <p data-role="verdict-counts">
              <span><VerdictLabel verdict="Supported" /> {entry.counts.supported}</span>{" "}
              <span><VerdictLabel verdict="Contradicted" /> {entry.counts.contradicted}</span>{" "}
              <span><VerdictLabel verdict="Unsupported" /> {entry.counts.unsupported}</span>
            </p>
          </>
        )}
        {actions(entry)}
        {rowError?.id === entry.id ? <p role="alert">{rowError.message}</p> : null}
      </li>
    );
  }

  return (
    <section data-mode="history" hidden={hidden} aria-labelledby="history-heading">
      <header>
        <h1 id="history-heading">History</h1>
        <p>
          Every chat and every check is saved automatically on this computer. Open one to pick up where you left
          off, or delete what you no longer need.
        </p>
      </header>

      {error ? <p role="alert">Couldn&apos;t load History: {error}</p> : null}
      {entries === null && busy ? <p role="status">Loading saved conversations and checks…</p> : null}

      {entries !== null ? (
        <>
          <h3>Conversations ({conversations.length})</h3>
          {conversations.length === 0 ? (
            <p data-role="note">No saved conversations yet. A chat is saved here after its first answer.</p>
          ) : (
            <ul data-role="history-list">{conversations.map(row)}</ul>
          )}

          <h3>Checks ({checks.length})</h3>
          {checks.length === 0 ? (
            <p data-role="note">No saved checks yet. Each run of the hallucination checker is saved here.</p>
          ) : (
            <ul data-role="history-list">{checks.map(row)}</ul>
          )}
        </>
      ) : null}
    </section>
  );
}
