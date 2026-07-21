"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import {
  formatAnswerBankText,
  parseAnswerBankText,
  parseCategoryBankPayload,
  parseCategoryBankQueuePayload,
} from "@/lib/category-bank-contract";
import type {
  CategoryBankPayload,
  CategoryBankQueuePayload,
  CategoryBankSaveInput,
} from "@/lib/category-bank-types";
import { parseApiResponse } from "@/lib/daily-contract";

type Operation = "loading" | "opening" | "saving" | "freezing" | "revising" | null;

function getDraftLabel(prompt: string) {
  const match = prompt.match(/^How many (.+) can you name\??$/i);
  const label = match?.[1] ?? prompt;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export function CategoryBankWorkspace({ initialPayload }: { initialPayload: CategoryBankQueuePayload | null }) {
  const [payload, setPayload] = useState(initialPayload);
  const [selectedId, setSelectedId] = useState(initialPayload?.drafts[0]?.draftId ?? null);
  const [bank, setBank] = useState<CategoryBankPayload | null>(initialPayload?.drafts[0]?.bank ?? null);
  const [snapshotDate, setSnapshotDate] = useState(bank?.snapshotDate ?? todayUtc());
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(String(bank?.timeLimitSeconds ?? 90));
  const [sourceLabel, setSourceLabel] = useState(bank?.sourceLabel ?? "");
  const [sourceUrl, setSourceUrl] = useState(bank?.sourceUrl ?? "");
  const [versionNote, setVersionNote] = useState(bank?.versionNote ?? "");
  const [answerText, setAnswerText] = useState(formatAnswerBankText(bank?.answers ?? []));
  const [validationVisible, setValidationVisible] = useState(false);
  const [operation, setOperation] = useState<Operation>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(initialPayload ? "" : "The bank workspace could not be loaded.");
  const formRef = useRef<HTMLFormElement>(null);
  const selected = payload?.drafts.find((draft) => draft.draftId === selectedId) ?? null;
  const validation = useMemo(() => parseAnswerBankText(answerText), [answerText]);
  const editing = bank?.status === "editing";

  function syncFields(nextBank: CategoryBankPayload | null) {
    setSnapshotDate(nextBank?.snapshotDate ?? todayUtc());
    setTimeLimitSeconds(String(nextBank?.timeLimitSeconds ?? 90));
    setSourceLabel(nextBank?.sourceLabel ?? "");
    setSourceUrl(nextBank?.sourceUrl ?? "");
    setVersionNote(nextBank?.versionNote ?? "");
    setAnswerText(formatAnswerBankText(nextBank?.answers ?? []));
    setValidationVisible(false);
  }

  function selectDraft(draftId: string) {
    const next = payload?.drafts.find((draft) => draft.draftId === draftId) ?? null;
    setSelectedId(draftId);
    setBank(next?.bank ?? null);
    syncFields(next?.bank ?? null);
    setMessage("");
    setError("");
  }

  function applyBank(nextBank: CategoryBankPayload) {
    setBank(nextBank);
    syncFields(nextBank);
    setPayload((current) => current ? {
      ...current,
      drafts: current.drafts.map((draft) => draft.draftId === nextBank.draftId ? {
        ...draft,
        revision: nextBank.revision,
        status: nextBank.status,
        available: true,
        bank: nextBank,
      } : draft),
    } : current);
  }

  async function reloadQueue() {
    setOperation("loading");
    setError("");
    try {
      const response = await fetch("/api/categories/banks", { cache: "no-store" });
      const parsed = parseApiResponse(await response.json(), parseCategoryBankQueuePayload);
      if (!parsed.ok) throw new Error(parsed.error.message);
      setPayload(parsed.data);
      const next = parsed.data.drafts[0] ?? null;
      setSelectedId(next?.draftId ?? null);
      setBank(next?.bank ?? null);
      syncFields(next?.bank ?? null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The bank workspace could not be loaded.");
    } finally {
      setOperation(null);
    }
  }

  async function postBank(path: string, nextOperation: Exclude<Operation, "loading" | "saving" | null>) {
    setOperation(nextOperation);
    setError("");
    setMessage("");
    try {
      const response = await fetch(path, { method: "POST" });
      const parsed = parseApiResponse(await response.json(), parseCategoryBankPayload);
      if (!parsed.ok) throw new Error(parsed.error.message);
      applyBank(parsed.data);
      setMessage(nextOperation === "opening" ? "Revision 1 is ready for private editing." : "A new correction revision is ready for editing.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The bank operation could not be completed.");
    } finally {
      setOperation(null);
    }
  }

  function buildSaveInput(): CategoryBankSaveInput | null {
    setValidationVisible(true);
    if (!formRef.current?.reportValidity() || validation.errors.length > 0) return null;
    return {
      snapshotDate,
      timeLimitSeconds: Number(timeLimitSeconds),
      sourceLabel,
      sourceUrl,
      versionNote,
      answers: validation.answers,
    };
  }

  async function saveDraft(showSuccess = true): Promise<CategoryBankPayload | null> {
    if (!selected || !editing || operation) return null;
    const input = buildSaveInput();
    if (!input) return null;
    setOperation("saving");
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/categories/banks/${selected.draftId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const parsed = parseApiResponse(await response.json(), parseCategoryBankPayload);
      if (!parsed.ok) throw new Error(parsed.error.message);
      applyBank(parsed.data);
      if (showSuccess) setMessage("Draft saved. The revision remains private and editable.");
      return parsed.data;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The bank draft could not be saved.");
      return null;
    } finally {
      setOperation(null);
    }
  }

  async function freezeDraft() {
    if (!selected || validation.canonicalCount < 2) {
      setValidationVisible(true);
      setError("Add at least two canonical answers before freezing this revision.");
      return;
    }
    const saved = await saveDraft(false);
    if (!saved) return;
    setOperation("freezing");
    setError("");
    try {
      const response = await fetch(`/api/categories/banks/${selected.draftId}/freeze`, { method: "POST" });
      const parsed = parseApiResponse(await response.json(), parseCategoryBankPayload);
      if (!parsed.ok) throw new Error(parsed.error.message);
      applyBank(parsed.data);
      setMessage(`Revision ${parsed.data.revision} is frozen for review. It is not published or playable.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The revision could not be frozen.");
    } finally {
      setOperation(null);
    }
  }

  if (payload && !payload.authorized) {
    return <section className="draft-frame"><BankHeader /><section className="review-access-boundary"><h1>Reviewer access required.</h1><p>This private workspace is available only to explicitly assigned reviewers.</p><Link href="/">Return to NameMore</Link></section></section>;
  }

  if (!payload) {
    return <section className="draft-frame"><BankHeader /><section className="review-access-boundary"><h1>Bank workspace unavailable.</h1><p>{error}</p><button type="button" disabled={operation === "loading"} onClick={() => void reloadQueue()}>{operation === "loading" ? "Retrying…" : "Retry"}</button></section></section>;
  }

  return (
    <section className="draft-frame">
      <BankHeader />
      <div className="bank-workspace">
        <aside className="bank-rail" aria-label="Answer-bank workspace">
          <h1>Bank workspace</h1>
          <div className="bank-rail-list">
            {payload.drafts.map((draft) => (
              <button key={draft.draftId} type="button" className={draft.draftId === selectedId ? "is-selected" : undefined} onClick={() => selectDraft(draft.draftId)} aria-current={draft.draftId === selectedId ? "true" : undefined}>
                <span><strong>{getDraftLabel(draft.prompt)}</strong><small>{draft.revision ? `Revision ${draft.revision} · ${draft.status === "editing" ? "Editing" : "Ready for review"}` : "Not started"}</small></span>
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 6 6-6 6" /></svg>
              </button>
            ))}
          </div>
          {payload.drafts.length === 0 ? <p className="bank-empty">No scope-approved categories are waiting for bank work.</p> : null}
          <Link className="bank-back-link" href="/review">Return to review queue</Link>
        </aside>

        <section className="bank-detail">
          <h2>Build the bank, then prove it.</h2>
          {selected ? (
            bank ? (
              <form ref={formRef} className="bank-form" onSubmit={(event) => { event.preventDefault(); void saveDraft(); }}>
                <label className="bank-field-wide">Approved prompt<input value={bank.prompt} readOnly /></label>
                <div className="bank-field-grid">
                  <label>Snapshot date<input type="date" value={snapshotDate} onChange={(event) => setSnapshotDate(event.target.value)} required disabled={!editing} /></label>
                  <label>Time limit<input type="number" value={timeLimitSeconds} onChange={(event) => setTimeLimitSeconds(event.target.value)} min={10} max={600} required disabled={!editing} /></label>
                </div>
                <label>Source label<input value={sourceLabel} onChange={(event) => setSourceLabel(event.target.value)} minLength={3} maxLength={160} required readOnly={!editing} placeholder="Official league roster" /></label>
                <label>Source URL<input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} minLength={12} maxLength={500} required readOnly={!editing} placeholder="https://…" /></label>
                <label>Version note<textarea value={versionNote} onChange={(event) => setVersionNote(event.target.value)} minLength={8} maxLength={500} required readOnly={!editing} placeholder="What this snapshot includes and excludes." /></label>
                <label>Canonical answers and aliases<span className="bank-helper">One answer per line. Separate aliases with <strong>|</strong></span><textarea aria-label="Canonical answers and aliases" className="bank-answer-editor" value={answerText} onChange={(event) => setAnswerText(event.target.value)} readOnly={!editing} placeholder={"LeBron James | LeBron\nStephen Curry | Steph Curry"} spellCheck={false} /></label>
                <div className={`bank-validation ${validationVisible && validation.errors.length ? "has-errors" : ""}`} role={validationVisible ? "status" : undefined}>
                  {validation.canonicalCount} canonical answers · {validation.aliasCount} aliases · {validation.errors.length ? `${validation.errors.length} issue${validation.errors.length === 1 ? "" : "s"}` : "No collisions"}
                  {validationVisible && validation.errors.length ? <ul>{validation.errors.slice(0, 4).map((issue) => <li key={issue}>{issue}</li>)}</ul> : null}
                </div>
                {editing ? <div className="bank-actions">
                  <button className="bank-save" type="submit" disabled={operation !== null}>{operation === "saving" ? "Saving…" : "Save draft"}</button>
                  <button className="bank-validate" type="button" disabled={operation !== null} onClick={() => setValidationVisible(true)}>Validate bank</button>
                  <button className="bank-freeze" type="button" disabled={operation !== null} onClick={() => void freezeDraft()}>{operation === "freezing" ? "Freezing…" : "Freeze for review"}</button>
                </div> : <div className="bank-actions is-ready"><button className="bank-freeze" type="button" disabled={operation !== null} onClick={() => void postBank(`/api/categories/banks/${selected.draftId}/revisions`, "revising")}>{operation === "revising" ? "Starting…" : "Start correction revision"}</button></div>}
              </form>
            ) : (
              <div className="bank-start"><h3>{selected.available ? "Start the first versioned bank." : "This bank is already being edited."}</h3><p>{selected.available ? "The approved prompt stays fixed while you add provenance, canonical answers, and explicit aliases." : "Another authorized reviewer owns the current editing revision."}</p>{selected.available ? <button type="button" disabled={operation !== null} onClick={() => void postBank(`/api/categories/banks/${selected.draftId}/open`, "opening")}>{operation === "opening" ? "Opening…" : "Begin bank"}</button> : null}</div>
            )
          ) : <div className="bank-start"><h3>No approved scopes are ready.</h3><p>Answer-bank work begins only after a separate reviewer approves a category scope.</p></div>}
          {message ? <p className="review-message is-success" role="status">{message}</p> : null}
          {error ? <p className="review-message is-error" role="alert">{error}</p> : null}
        </section>

        <aside className="bank-boundary">
          <h2>Publication boundary</h2>
          <p>This revision is private reviewer work.</p>
          <p>Freezing preserves a versioned snapshot. It does not publish the category, make it playable, or grant ranked eligibility.</p>
          <ul><li><span aria-hidden="true">✓</span> Reviewer authority verified</li><li><span aria-hidden="true">✓</span> Approved scope preserved</li><li><span aria-hidden="true">✓</span> Aliases collision-checked</li><li><span aria-hidden="true">✓</span> Public release still blocked</li></ul>
        </aside>
      </div>
    </section>
  );
}

function BankHeader() {
  return <header className="discovery-header"><Link className="brand" href="/">NameMore</Link><nav aria-label="Primary navigation"><Link href="/daily">Daily</Link><Link href="/room">Private rooms</Link></nav></header>;
}
