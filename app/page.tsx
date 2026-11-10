"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ComponentType } from "react";
import logo from "./assets/source-sync-logo.png";
import BatchProcessing, { type LoadedItems } from "./components/BatchProcessing";
import DocumentChatbot, { type CheckerDraft } from "./components/DocumentChatbot";
import HallucinationChecker from "./components/HallucinationChecker";
import HuggingFaceImport from "./components/HuggingFaceImport";
import { BatchIcon, ChatIcon, CheckerIcon, HistoryIcon, ImportIcon } from "./components/icons";
import SavedHistory from "./components/SavedHistory";
import type { SavedCheck, SavedConversation } from "../lib/types";

type Mode = "chat" | "checker" | "huggingface" | "batch" | "history";

const MODES: { id: Mode; label: string; Icon: ComponentType<{ size?: number }> }[] = [
  { id: "chat", label: "Chat", Icon: ChatIcon },
  { id: "checker", label: "Hallucination checker", Icon: CheckerIcon },
  { id: "huggingface", label: "Hugging Face import", Icon: ImportIcon },
  { id: "batch", label: "Batch check", Icon: BatchIcon },
  { id: "history", label: "History", Icon: HistoryIcon },
];

// Semantic HTML styled by app/globals.css, which targets elements and data-*
// hooks only (no classes or inline styles).
export default function Home() {
  const [mode, setMode] = useState<Mode>("chat");
  // A new object on every "Send to Checker" click, so repeat sends still refill the form.
  const [checkerDraft, setCheckerDraft] = useState<CheckerDraft | null>(null);
  const [batchItems, setBatchItems] = useState<LoadedItems | null>(null);
  // New objects each time an item is opened from History, so reopening the same one still restores it.
  const [openConversation, setOpenConversation] = useState<SavedConversation | null>(null);
  const [openCheck, setOpenCheck] = useState<SavedCheck | null>(null);

  // On a phone the modes are a sideways-scrolling tab bar; keep the current one in view,
  // including when opening a saved item switches modes for you.
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    nav.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [mode]);

  // Every mode stays mounted (just hidden), so switching keeps its state.
  return (
    <div data-role="app">
      <nav aria-label="Modes" data-role="sidebar" ref={nav}>
        {/* The Source Sync logo, exported from Canva ("Source Sync logo"); its ink ground matches the rail. */}
        <p data-role="brand">
          <Image src={logo} alt="Source Sync" width={192} preload />
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
          restore={openConversation}
        />
        <HallucinationChecker hidden={mode !== "checker"} draft={checkerDraft} restore={openCheck} />
        <HuggingFaceImport
          hidden={mode !== "huggingface"}
          onUseInBatch={(loaded) => {
            setBatchItems(loaded);
            setMode("batch");
          }}
        />
        <BatchProcessing hidden={mode !== "batch"} loaded={batchItems} onLoad={setBatchItems} />
        <SavedHistory
          hidden={mode !== "history"}
          onOpen={(entry) => {
            if (entry.kind === "conversation") {
              setOpenConversation({ ...entry });
              setMode("chat");
            } else {
              setOpenCheck({ ...entry });
              setMode("checker");
            }
          }}
        />
      </main>
    </div>
  );
}
