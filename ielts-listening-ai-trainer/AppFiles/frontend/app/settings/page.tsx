"use client";

import { useState } from "react";
import Modal from "../../components/Modal";
import { TrainerSession } from "../../lib/sessionStore";
import { usePracticeStore } from "../../lib/practiceStore";

export default function SettingsPage() {
  const { session, clearSession, setSessionFromTranscription } = usePracticeStore();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function exportBackup() {
    const payload = JSON.stringify(session, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ielts-listening-backup.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function importBackup(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = JSON.parse(String(reader.result)) as TrainerSession;
      setSessionFromTranscription(parsed);
    };
    reader.readAsText(file);
  }

  return (
    <div className="glass stage space-y-8">
      <section className="soft-card rounded-[28px] p-6">
        <p className="text-sm font-semibold text-slate-500">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Local-first training data</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Sessions are stored in this browser. Uploaded audio is cached locally when the browser supports IndexedDB.
        </p>
      </section>
      <section className="grid gap-8 lg:grid-cols-3">
        <button className="soft-card rounded-[28px] px-8 py-16 text-5xl font-light text-slate-700" onClick={exportBackup}>
          Create Backup
        </button>
        <button className="soft-card rounded-[28px] px-8 py-16 text-5xl font-light text-slate-700" onClick={exportBackup}>
          Export Backup
        </button>
        <label className="soft-card cursor-pointer rounded-[28px] px-8 py-16 text-center text-5xl font-light text-slate-700">
          Import Backup
          <input
            className="sr-only"
            type="file"
            accept="application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importBackup(file);
            }}
          />
        </label>
      </section>
      <section className="soft-card rounded-[28px] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-slate-900">{session.sourceName || "No active session"}</p>
            <p className="mt-1 text-sm text-slate-500">{session.sentences.length} sentences saved</p>
          </div>
          <button className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white" onClick={() => setConfirmOpen(true)}>
            Reset session
          </button>
        </div>
      </section>

      <Modal open={confirmOpen} title="Reset saved session" onClose={() => setConfirmOpen(false)}>
        <p className="text-sm leading-7 text-slate-600">This removes the transcript, answers, scores, and analysis from this browser.</p>
        <button
          className="mt-5 rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white"
          onClick={() => {
            clearSession();
            setConfirmOpen(false);
          }}
        >
          Reset
        </button>
      </Modal>
    </div>
  );
}
