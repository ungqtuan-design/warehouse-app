"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { updateOutboundNoteAction } from "@/app/actions/warehouse";
import { primaryActionButtonClass, secondaryActionButtonClass } from "@/components/action-feedback";

export type OutboundNoteText = {
  note: string;
  addNote: string;
  editNote: string;
  saveNote: string;
  cancelNote: string;
  savingNote: string;
  noteHint: string;
  noteSaved: string;
  noteInvalid: string;
  noteUnavailable: string;
  noteSaveError: string;
};

export function OutboundNoteEditor({ transactionId, note, text }: {
  transactionId: string;
  note: string | null;
  text: OutboundNoteText;
}) {
  const router = useRouter();
  const [currentNote, setCurrentNote] = useState(note);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note ?? "");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const savingRef = useRef(false);
  const inputId = `outbound-note-${transactionId}`;

  async function saveNote() {
    if (savingRef.current) return;
    savingRef.current = true;
    setPending(true);
    setMessage("");
    try {
      const result = await updateOutboundNoteAction({ transactionId, note: draft });
      if (result.status === "success") {
        setCurrentNote(result.note ?? null);
        setEditing(false);
        setMessage(text.noteSaved);
        router.refresh();
      } else {
        setMessage(result.message === "outbound-note-invalid" ? text.noteInvalid
          : result.message === "outbound-note-unavailable" ? text.noteUnavailable : text.noteSaveError);
      }
    } catch {
      setMessage(text.noteSaveError);
    } finally {
      savingRef.current = false;
      setPending(false);
    }
  }

  return (
    <div className="min-w-48 max-w-md">
      {editing ? (
        <div className="grid gap-2">
          <label htmlFor={inputId} className="sr-only">{text.note}</label>
          <textarea
            id={inputId}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={500}
            rows={3}
            autoFocus
            disabled={pending}
            aria-describedby={`${inputId}-hint ${inputId}-message`}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500 disabled:opacity-70"
          />
          <p id={`${inputId}-hint`} className="text-xs text-slate-500">{text.noteHint}</p>
          <div className="flex gap-2">
            <button type="button" disabled={pending} onClick={saveNote} className={primaryActionButtonClass}>
              {pending ? text.savingNote : text.saveNote}
            </button>
            <button type="button" disabled={pending} onClick={() => { setEditing(false); setMessage(""); }} className={secondaryActionButtonClass}>
              {text.cancelNote}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <span className="min-w-0 whitespace-pre-wrap break-words">{currentNote || "-"}</span>
          <button type="button" disabled={pending} onClick={() => { setDraft(currentNote ?? ""); setMessage(""); setEditing(true); }} className="shrink-0 rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-sm font-semibold text-cyan-900 hover:bg-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 disabled:opacity-70">
            {currentNote ? text.editNote : text.addNote}
          </button>
        </div>
      )}
      <p id={`${inputId}-message`} role="status" className={`mt-1 text-xs ${editing ? "text-rose-700" : "text-emerald-700"}`}>{message}</p>
    </div>
  );
}
