"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  parseCategoryReviewDecisionPayload,
  parseCategoryReviewQueuePayload,
} from "@/lib/category-review-contract";
import type { CategoryReviewQueuePayload } from "@/lib/category-review-types";
import type { CategoryDraftReviewDecision } from "@/lib/category-discovery-types";
import { parseApiResponse } from "@/lib/daily-contract";

function getDraftLabel(prompt: string) {
  const match = prompt.match(/^How many (.+) can you name\??$/i);
  const label = match?.[1] ?? prompt;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const outcomeLabels: Record<CategoryDraftReviewDecision, string> = {
  "request-changes": "Changes requested. The owner can revise and resubmit.",
  reject: "Draft rejected. The submitted snapshot remains preserved.",
  "scope-approve": "Scope approved. An answer bank is still required.",
};

export function CategoryReviewWorkspace({
  initialPayload,
}: {
  initialPayload: CategoryReviewQueuePayload | null;
}) {
  const [payload, setPayload] = useState(initialPayload);
  const [selectedId, setSelectedId] = useState(initialPayload?.drafts[0]?.id ?? null);
  const [note, setNote] = useState("");
  const [operation, setOperation] = useState<CategoryDraftReviewDecision | "loading" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(initialPayload ? "" : "The review workspace could not be loaded.");
  const formRef = useRef<HTMLFormElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const selectedDraft = payload?.drafts.find((draft) => draft.id === selectedId) ?? null;

  useEffect(() => {
    if (message) messageRef.current?.focus();
  }, [message]);

  async function reloadQueue() {
    setOperation("loading");
    setError("");
    try {
      const response = await fetch("/api/categories/review", { cache: "no-store" });
      const parsed = parseApiResponse(await response.json(), parseCategoryReviewQueuePayload);
      if (!parsed.ok) throw new Error(parsed.error.message);
      setPayload(parsed.data);
      setSelectedId(parsed.data.drafts[0]?.id ?? null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The review workspace could not be loaded.");
    } finally {
      setOperation(null);
    }
  }

  function selectDraft(draftId: string) {
    setSelectedId(draftId);
    setNote("");
    setMessage("");
    setError("");
  }

  async function decideReview(decision: CategoryDraftReviewDecision) {
    const currentPayload = payload;
    if (!selectedDraft || !currentPayload || operation || !formRef.current?.reportValidity()) return;
    setOperation(decision);
    setMessage("");
    setError("");
    try {
      const response = await fetch(
        `/api/categories/review/${selectedDraft.id}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, note }),
        },
      );
      const parsed = parseApiResponse(await response.json(), parseCategoryReviewDecisionPayload);
      if (!parsed.ok) throw new Error(parsed.error.message);
      const remainingDrafts = currentPayload.drafts.filter((draft) => draft.id !== selectedDraft.id);
      setPayload({ ...currentPayload, drafts: remainingDrafts });
      setSelectedId(remainingDrafts[0]?.id ?? null);
      setNote("");
      setMessage(outcomeLabels[parsed.data.decision]);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The review decision could not be recorded.");
    } finally {
      setOperation(null);
    }
  }

  if (payload && !payload.authorized) {
    return (
      <section className="draft-frame">
        <ReviewHeader />
        <section className="review-access-boundary">
          <h1>Reviewer access required.</h1>
          <p>This private workspace is available only to explicitly assigned reviewers.</p>
          <Link href="/">Return to NameMore</Link>
        </section>
      </section>
    );
  }

  if (!payload) {
    return (
      <section className="draft-frame">
        <ReviewHeader />
        <section className="review-access-boundary" aria-busy={operation === "loading"}>
          <h1>Review workspace unavailable.</h1>
          <p>{error}</p>
          <button type="button" disabled={operation === "loading"} onClick={() => void reloadQueue()}>
            {operation === "loading" ? "Retrying…" : "Retry"}
          </button>
        </section>
      </section>
    );
  }

  return (
    <section className="draft-frame">
      <ReviewHeader />
      <div className="review-workspace">
        <aside className="review-queue" aria-label="Category review queue">
          <h1>Review queue</h1>
          <div className="review-queue-list">
            {payload.drafts.map((draft) => (
              <button
                className={draft.id === selectedId ? "is-selected" : undefined}
                type="button"
                key={draft.id}
                onClick={() => selectDraft(draft.id)}
                aria-current={draft.id === selectedId ? "true" : undefined}
              >
                <span>
                  <strong>{getDraftLabel(draft.prompt)}</strong>
                  <small>Pending review</small>
                </span>
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 6 6-6 6" /></svg>
              </button>
            ))}
          </div>
          {payload.drafts.length === 0 ? <p className="review-queue-empty">No drafts are pending review.</p> : null}
          <Link className="bank-back-link" href="/review/banks">Build approved banks</Link>
        </aside>

        <section className="review-detail" aria-busy={operation !== null}>
          <h2>Review the evidence, not the promise.</h2>
          {selectedDraft ? (
            <form
              className="review-form"
              ref={formRef}
              onSubmit={(event) => {
                event.preventDefault();
                void decideReview("scope-approve");
              }}
            >
              <label>
                Category prompt
                <textarea value={selectedDraft.prompt} readOnly />
              </label>
              <label>
                Source or provenance
                <textarea value={selectedDraft.sourceNotes} readOnly />
              </label>
              <label>
                Coverage boundaries
                <textarea value={selectedDraft.coverageNotes} readOnly />
              </label>
              <label>
                Reviewer note
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Record the reason for this outcome."
                  minLength={12}
                  maxLength={600}
                  required
                  autoFocus
                />
              </label>
              <div className="review-actions">
                <button
                  className="review-request-changes"
                  type="button"
                  disabled={operation !== null}
                  onClick={() => void decideReview("request-changes")}
                >
                  {operation === "request-changes" ? "Recording…" : "Request changes"}
                </button>
                <button
                  className="review-reject"
                  type="button"
                  disabled={operation !== null}
                  onClick={() => void decideReview("reject")}
                >
                  {operation === "reject" ? "Recording…" : "Reject draft"}
                </button>
                <button className="review-approve" type="submit" disabled={operation !== null}>
                  {operation === "scope-approve" ? "Recording…" : "Approve scope"}
                </button>
              </div>
            </form>
          ) : (
            <div className="review-empty-detail">
              <h3>The queue is clear.</h3>
              <p>There are no submitted category drafts waiting for a decision.</p>
            </div>
          )}
          {message ? <p ref={messageRef} className="review-message is-success" role="status" tabIndex={-1}>{message}</p> : null}
          {error ? <p className="review-message is-error" role="alert">{error}</p> : null}
        </section>

        <aside className="review-decision-boundary">
          <h2>Decision boundary</h2>
          <p>A review outcome records a moderated decision on this submitted snapshot.</p>
          <p>It does not create an answer bank, publish the prompt, make it playable, or grant ranked eligibility.</p>
          <ul>
            <li><span aria-hidden="true">✓</span> Reviewer authority verified</li>
            <li><span aria-hidden="true">✓</span> Submitted snapshot preserved</li>
            <li><span aria-hidden="true">✓</span> Reason recorded</li>
            <li><span aria-hidden="true">✓</span> Answer bank still required</li>
          </ul>
        </aside>
      </div>
    </section>
  );
}

function ReviewHeader() {
  return (
    <header className="discovery-header">
      <Link className="brand" href="/">NameMore</Link>
      <nav aria-label="Primary navigation">
        <Link href="/daily">Daily</Link>
        <Link href="/room">Private rooms</Link>
      </nav>
    </header>
  );
}
