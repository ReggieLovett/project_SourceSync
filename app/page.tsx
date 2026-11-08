"use client";

import { useState, type ComponentType } from "react";
import BatchProcessing, { type LoadedItems } from "./components/BatchProcessing";
import DocumentChatbot, { type CheckerDraft } from "./components/DocumentChatbot";
import HallucinationChecker from "./components/HallucinationChecker";
import HuggingFaceImport from "./components/HuggingFaceImport";
import { BatchIcon, ChatIcon, CheckerIcon, ImportIcon } from "./components/icons";
import SyncSeal from "./components/SyncSeal";

type Mode = "chat" | "checker" | "huggingface" | "batch";

const MODES: { id: Mode; label: string; Icon: ComponentType<{ size?: number }> }[] = [
  { id: "chat", label: "Chat", Icon: ChatIcon },
  { id: "checker", label: "Hallucination checker", Icon: CheckerIcon },
  { id: "huggingface", label: "Hugging Face import", Icon: ImportIcon },
  { id: "batch", label: "Batch check", Icon: BatchIcon },
];

// Semantic HTML styled by app/globals.css, which targets elements and data-*
// hooks only (no classes or inline styles).
export default function Home() {
  const [mode, setMode] = useState<Mode>("chat");
  // A new object on every "Send to Checker" click, so repeat sends still refill the form.
  const [checkerDraft, setCheckerDraft] = useState<CheckerDraft | null>(null);
  const [batchItems, setBatchItems] = useState<LoadedItems | null>(null);

  // Every mode stays mounted (just hidden), so switching keeps its state.
  return (
    <div data-role="app">
      <nav aria-label="Modes" data-role="sidebar">
        <p data-role="brand">
          <SyncSeal />
          <span>Source Sync</span>
        </p>
        <ul>
          {MODES.map(({ id, label, Icon }) => (
            <li key={id}>
              <button type="button" aria-current={mode === id ? "page" : undefined} onClick={() => setMode(id)}>
                <Icon />
                <span>{label}</span>
              </button>
            </li>
          ))}
        </ul>
        <p data-role="stack">
          <span>Groq</span> <span>ChromaDB</span> <span>Hugging Face</span>
        </p>
      </nav>
      <main>
        <DocumentChatbot
          hidden={mode !== "chat"}
          onSendToChecker={(draft) => {
            setCheckerDraft({ ...draft });
            setMode("checker");
          }}
        />
        <HallucinationChecker hidden={mode !== "checker"} draft={checkerDraft} />
        <HuggingFaceImport
          hidden={mode !== "huggingface"}
          onUseInBatch={(loaded) => {
            setBatchItems(loaded);
            setMode("batch");
          }}
        />
        <BatchProcessing hidden={mode !== "batch"} loaded={batchItems} onLoad={setBatchItems} />
      </main>
    </div>
  );
}
