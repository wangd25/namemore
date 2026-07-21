"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import {
  parseCategoryBankDecisionPayload,
  parseCategoryBankReviewQueuePayload,
} from "@/lib/category-bank-review-contract";
import type { CategoryBankReviewQueuePayload } from "@/lib/category-bank-review-types";
import type { CategoryBankReviewDecision } from "@/lib/category-bank-types";
import { parseApiResponse } from "@/lib/daily-contract";

function getDraftLabel(prompt: string) {
  const match = prompt.match(/^How many (.+) can you name\??$/i);
  const label = match?.[1] ?? prompt;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function decisionMessage(decision: CategoryBankReviewDecision, revision: number) {
  if (decision === "request-correction") return `Correction requested for revision ${revision}. The frozen snapshot remains unchanged.`;
  if (decision === "reject") return `Revision ${revision} was rejected. It remains private and unplayable.`;
  return `Revision ${revision} was approved as reviewed. Publishing and play remain blocked.`;
}

export function CategoryBankReviewWorkspace({
  initialPayload,
}: {
  initialPayload: CategoryBankReviewQueuePayload | null;
}) {
  const [payload, setPayload] = useState(initialPayload);
  const [selectedId, setSelectedId] = useState(initialPayload?.banks[0]?.draftId ?? null);
  const [note, setNote] = useState("");
  const [operation, setOperation] = useState<CategoryBankReviewDecision | "loading" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(initialPayload ? "" : "The bank review queue could not be loaded.");
  const formRef = useRef<HTMLFormElement>(null);
  const selected = payload?.banks.find((bank) => bank.draftId === selectedId) ?? null;

  function selectBank(draftId: string) {
    setSelectedId(draftId);
    setNote("");
    setMessage("");
    setError("");
  }

  async function reloadQueue() {
    setOperation("loading");
    setError("");
    try {
      const response = await fetch("/api/categories/banks/reviews", { cache: "no-store" });
      const parsed = parseApiResponse(await response.json(), parseCategoryBankReviewQueuePayload);
      if (!parsed.ok) throw new Error(parsed.error.message);
      setPayload(parsed.data);
      setSelectedId(parsed.data.banks[0]?.draftId ?? null);
      setNote("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The bank review queue could not be loaded.");
    } finally {
      setOperation(null);
    }
  }

  async function decide(decision: CategoryBankReviewDecision) {
    if (!selected || operation || !formRef.current?.reportValidity()) return;
    setOperation(decision);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/categories/banks/${selected.draftId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note }),
      });
      const parsed = parseApiResponse(await response.json(), parseCategoryBankDecisionPayload);
      if (!parsed.ok) throw new Error(parsed.error.message);
      const nextBanks = payload?.banks.filter((bank) => bank.draftId !== selected.draftId) ?? [];
      setPayload((current) => current ? { ...current, banks: nextBanks } : current);
      setSelectedId(nextBanks[0]?.draftId ?? null);
      setNote("");
      setMessage(decisionMessage(parsed.data.decision, parsed.data.revision));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The answer-bank decision could not be recorded.");
    } finally {
      setOperation(null);
    }
  }

  if (payload && !payload.authorized) {
    return <section className="draft-frame"><BankReviewHeader /><section className="review-access-boundary"><h1>Reviewer access required.</h1><p>This private decision workspace is available only to explicitly assigned reviewers.</p><Link href="/">Return to NameMore</Link></section></section>;
  }

  if (!payload) {
    return <section className="draft-frame"><BankReviewHeader /><section className="review-access-boundary"><h1>Bank review unavailable.</h1><p>{error}</p><button type="button" disabled={operation === "loading"} onClick={() => void reloadQueue()}>{operation === "loading" ? "Retrying…" : "Retry"}</button></section></section>;
  }

  return (
    <section className="draft-frame">
      <BankReviewHeader />
      <div className="bank-decision-workspace">
        <aside className="bank-decision-rail" aria-label="Bank review queue">
          <h1>Bank review queue</h1>
          <div className="bank-decision-list">
            {payload.banks.map((bank) => (
              <button key={`${bank.draftId}-${bank.revision}`} type="button" className={bank.draftId === selectedId ? "is-selected" : undefined} onClick={() => selectBank(bank.draftId)} aria-current={bank.draftId === selectedId ? "true" : undefined}>
                <span><strong>{getDraftLabel(bank.prompt)}</strong><small>Revision {bank.revision} · Awaiting decision</small></span>
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 6 6-6 6" /></svg>
              </button>
            ))}
          </div>
          {payload.banks.length === 0 ? <p className="bank-empty">No independent bank decisions are waiting.</p> : null}
          <Link className="bank-back-link" href="/review/banks">Return to bank workspace</Link>
        </aside>

        <main className="bank-decision-detail">
          <h2>Review every name, then decide.</h2>
          {selected ? (
            <form ref={formRef} className="bank-decision-form" onSubmit={(event) => event.preventDefault()}>
              <ReadOnlyRow label="Approved prompt" value={selected.prompt} />
              <ReadOnlyRow label="Provenance" value={selected.sourceLabel ?? "—"} href={selected.sourceUrl ?? undefined} />
              <ReadOnlyRow label="Snapshot date" value={selected.snapshotDate ?? "—"} />
              <ReadOnlyRow label="Version note" value={selected.versionNote ?? "—"} />
              <div className="bank-decision-answer-field">
                <span>Canonical answers and aliases</span>
                <div className="bank-decision-answers" aria-label="Canonical answers and aliases">
                  {selected.answers.map((answer) => (
                    <code key={answer.canonicalText}>{[answer.canonicalText, ...answer.aliases].join(" | ")}</code>
                  ))}
                </div>
              </div>
              <label className="bank-decision-note">Reviewer note<textarea value={note} onChange={(event) => setNote(event.target.value)} minLength={12} maxLength={600} required placeholder="Explain the evidence behind this decision." /></label>
              <div className="bank-decision-actions">
                <button className="bank-request-correction" type="button" disabled={operation !== null} onClick={() => void decide("request-correction")}>{operation === "request-correction" ? "Recording…" : "Request correction"}</button>
                <button className="bank-reject" type="button" disabled={operation !== null} onClick={() => void decide("reject")}>{operation === "reject" ? "Recording…" : "Reject bank"}</button>
                <button className="bank-approve" type="button" disabled={operation !== null} onClick={() => void decide("approve")}>{operation === "approve" ? "Recording…" : "Approve bank"}</button>
              </div>
            </form>
          ) : <div className="bank-start"><h3>No frozen banks are waiting.</h3><p>A bank appears here only after a different reviewer freezes a complete revision.</p></div>}
          {message ? <p className="review-message is-success" role="status">{message}</p> : null}
          {error ? <p className="review-message is-error" role="alert">{error}</p> : null}
        </main>

        <aside className="bank-decision-boundary">
          <h2>Decision boundary</h2>
          <p>This decision applies only to this frozen revision.</p>
          <p>Approval confirms the reviewed bank snapshot. It does not publish the category, make it playable, or grant ranked eligibility.</p>
          <ul><li><span aria-hidden="true">✓</span> Reviewer authority verified</li><li><span aria-hidden="true">✓</span> Independent reviewer enforced</li><li><span aria-hidden="true">✓</span> Frozen snapshot preserved</li><li><span aria-hidden="true">✓</span> Public release still blocked</li></ul>
        </aside>
      </div>
    </section>
  );
}

function ReadOnlyRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return <div className="bank-decision-row"><span>{label}</span><output>{href ? <a href={href} target="_blank" rel="noreferrer">{value}</a> : value}</output></div>;
}

function BankReviewHeader() {
  return <header className="discovery-header"><Link className="brand" href="/">NameMore</Link><nav aria-label="Primary navigation"><Link href="/daily">Daily</Link><Link href="/room">Private rooms</Link></nav></header>;
}
