"use client";

import { useEffect, useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent } from "react";
import { apiRequest, errorMessage, newHistoryId, postJson, putJson } from "../../lib/api-client";
import { LIMITS } from "../../lib/config";
import type {
  ChatEntry,
  ChatMessage,
  ChatResponse,
  HistoryEntry,
  HistorySaveRequest,
  SavedConversation,
  UploadedDocument,
} from "../../lib/types";
import { MultilineText, plural } from "./CheckResultView";
import { AttachIcon, SendIcon, StopIcon } from "./icons";
import { useElapsedSeconds, useRequest } from "./hooks";

export type CheckerDraft = { question: string; context: string; answer: string };

const ACCEPTED_TYPES = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** `restore` changes when a saved conversation is opened from History. */
export default function DocumentChatbot({
  hidden,
  onSendToChecker,
  restore,
}: {
  hidden: boolean;
  onSendToChecker: (draft: CheckerDraft) => void;
  restore: SavedConversation | null;
}) {
  const [document, setDocument] = useState<UploadedDocument | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [chatError, setChatError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  // The history ID of the conversation on screen; null until its first answer is saved.
  const conversationId = useRef<string | null>(null);
  // Saves run one at a time, so an older copy can never land after a newer one.
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const upload = useRequest();
  const chat = useRequest();
  const uploadSeconds = useElapsedSeconds(upload.busy);
  const fileInput = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);

  const { cancel: cancelChat } = chat;
  useEffect(() => {
    if (!restore) return;
    cancelChat();
    conversationId.current = restore.id;
    setMessages(restore.messages);
    setDocument(restore.document);
    setInput("");
    setChatError("");
    setSaveError("");
    setSaveState("saved");
  }, [restore, cancelChat]);

  /**
   * Save the whole conversation under its history ID (created on the first save).
   * Queued behind any save still in flight for this tab.
   */
  function saveConversation(entries: ChatEntry[], attached: UploadedDocument | null) {
    conversationId.current ??= newHistoryId();
    const id = conversationId.current;
    const body: HistorySaveRequest = {
      kind: "conversation",
      document: attached,
      messages: entries.slice(-LIMITS.historyMessages),
    };
    saveQueue.current = saveQueue.current.then(async () => {
      try {
        await putJson<HistoryEntry>(`/api/history/${id}`, body);
        if (conversationId.current === id) {
          setSaveError("");
          setSaveState("saved");
        }
      } catch (error) {
        if (conversationId.current === id) {
          setSaveError(errorMessage(error));
          setSaveState("error");
        }
      }
    });
  }

  function startNewChat() {
    conversationId.current = null;
    setMessages([]);
    setChatError("");
    setSaveError("");
    setSaveState("idle");
  }

  // Keep the newest message in view, like a chat app.
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [messages.length, chat.busy]);

  async function attach(file: File | undefined) {
    if (!file) return;
    setUploadError("");
    const form = new FormData();
    form.append("file", file);
    try {
      // The browser sets the multipart boundary header itself.
      setDocument(await upload.run((signal) =>
        apiRequest<UploadedDocument>("/api/upload", { method: "POST", body: form, signal })));
    } catch (error) {
      setUploadError(errorMessage(error));
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function handleSend(event?: FormEvent) {
    event?.preventDefault();
    const question = input.trim();
    if (!question || chat.busy) return;
    const history: ChatMessage[] = messages.map(({ role, content }) => ({ role, content }));
    const asked: ChatEntry[] = [...messages, { role: "user", content: question }];
    const attached = document;
    setMessages(asked);
    setInput("");
    setChatError("");
    try {
      const response = await chat.run((signal) => postJson<ChatResponse>("/api/chat", {
        documentId: document?.documentId ?? null,
        messages: [...history, { role: "user", content: question }],
      }, signal));
      const answered: ChatEntry[] = [...asked, { role: "assistant", content: response.answer, response }];
      setMessages(answered);
      saveConversation(answered, attached);
    } catch (error) {
      setChatError(errorMessage(error));
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void handleSend();
    }
  }

  function handleDrag(event: DragEvent<HTMLElement>) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    void attach(event.dataTransfer.files[0]);
  }

  return (
    <section
      data-mode="chat"
      hidden={hidden}
      aria-labelledby="chat-heading"
      data-dragging={dragging ? "true" : undefined}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <header>
        <h1 id="chat-heading">Chat</h1>
        <p>
          Ask anything. Attach a PDF or DOCX with + (or drop it here) to get answers only from that document,
          then send any answer to the checker.
        </p>
      </header>

      <div role="log" aria-live="polite" aria-label="Chat history" ref={log}>
        {messages.length === 0 ? (
          <p data-role="empty">No messages yet. Ask a question to start.</p>
        ) : (
          <ol>
            {messages.map((message, index) => (
              <li key={index} data-role={message.role}>
                <p>
                  <strong>{message.role === "user" ? "You" : "Assistant"}</strong>
                </p>
                <p>
                  <MultilineText text={message.content} />
                </p>
                {message.role === "assistant" ? (
                  <>
                    <p>
                      <button
                        type="button"
                        onClick={() => onSendToChecker({
                          question: message.response.question,
                          answer: message.response.answer,
                          context: message.response.contextText,
                        })}
                      >
                        Send to checker
                      </button>{" "}
                      <small>
                        {message.response.fileName ? `From ${message.response.fileName}` : "General knowledge, no document"} ·{" "}
                        {(message.response.durationMs / 1000).toFixed(1)} s
                      </small>
                    </p>
                    {message.response.context.length > 0 ? (
                      <details>
                        <summary>Retrieved context ({plural(message.response.context.length, "excerpt")})</summary>
                        <ol>
                          {message.response.context.map((chunk) => (
                            <li key={chunk.id}>
                              <p>
                                <small>
                                  Chunk #{chunk.chunkIndex}
                                  {chunk.distance !== null ? ` · cosine distance ${chunk.distance}` : ""}
                                </small>
                              </p>
                              <blockquote>{chunk.text}</blockquote>
                            </li>
                          ))}
                        </ol>
                      </details>
                    ) : null}
                  </>
                ) : null}
              </li>
            ))}
          </ol>
        )}
        {chat.busy ? <p role="status">{document ? "Searching the document and answering…" : "Answering…"}</p> : null}
      </div>

      <div data-role="composer-area">
        {document ? (
          <p data-role="attachment">
            Answering from <strong>{document.fileName}</strong>
            <small>
              {" "}({document.pages !== null ? `${plural(document.pages, "page")}, ` : ""}{plural(document.chunks, "chunk")})
            </small>{" "}
            <button type="button" onClick={() => setDocument(null)} disabled={chat.busy}>Remove</button>
          </p>
        ) : null}
        {upload.busy ? (
          <p role="status">Reading and embedding the document… {uploadSeconds} s (the first upload also downloads the embedding model)</p>
        ) : null}
        {uploadError ? <p role="alert">Couldn&apos;t attach the file: {uploadError}</p> : null}
        {chatError ? <p role="alert">Chat failed: {chatError}</p> : null}
        {saveState === "error" ? <p role="alert">Couldn&apos;t save this conversation to History: {saveError}</p> : null}

        <form data-role="composer" onSubmit={handleSend}>
          <input ref={fileInput} type="file" accept={ACCEPTED_TYPES} hidden onChange={(event) => void attach(event.target.files?.[0])} />
          <button
            type="button"
            data-role="attach"
            aria-label="Attach a PDF or DOCX"
            title="Attach a PDF or DOCX"
            disabled={upload.busy}
            onClick={() => fileInput.current?.click()}
          >
            <AttachIcon />
          </button>
          <label htmlFor="chat-input" hidden>Message</label>
          <textarea
            id="chat-input"
            rows={1}
            value={input}
            maxLength={4000}
            placeholder={document ? `Ask about ${document.fileName}` : "Ask anything"}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          {chat.busy ? (
            <button type="button" data-role="send" onClick={chat.cancel} aria-label="Stop">
              <StopIcon />
            </button>
          ) : (
            <button type="submit" data-role="send" disabled={!input.trim()} aria-label="Send">
              <SendIcon />
            </button>
          )}
        </form>
        <p data-role="composer-hint">
          <small>
            <kbd>Enter</kbd> to send · <kbd>Shift</kbd> + <kbd>Enter</kbd> for a new line · PDF or DOCX, up to 20 MB
            {saveState === "saved" ? " · Saved to History" : ""}
          </small>{" "}
          {messages.length > 0 ? (
            <button type="button" disabled={chat.busy} onClick={startNewChat}>
              New chat
            </button>
          ) : null}
        </p>
      </div>

      {dragging ? <div data-role="dropzone" aria-hidden="true">Drop a PDF or DOCX to chat about it</div> : null}
    </section>
  );
}
