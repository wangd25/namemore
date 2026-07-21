"use client";

import { useEffect, useRef, useState } from "react";

import { parseCategoryReportReceipt } from "@/lib/category-moderation-contract";
import type { CategoryReportReason } from "@/lib/category-moderation-types";
import { parseApiResponse } from "@/lib/daily-contract";

const reasonOptions: Array<{ value: CategoryReportReason; label: string }> = [
  { value: "answer-bank-accuracy", label: "Answer-bank accuracy" },
  { value: "coverage-or-wording", label: "Coverage or wording" },
  { value: "provenance-or-copyright", label: "Provenance or copyright" },
  { value: "offensive-or-unsafe", label: "Offensive or unsafe content" },
  { value: "other", label: "Something else" },
];

export function CategoryReportDialog({
  categorySlug,
  categoryTitle,
}: {
  categorySlug: string;
  categoryTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<CategoryReportReason>("answer-bank-accuracy");
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  function closeDialog() {
    if (submitting) return;
    setOpen(false);
    setMessage("");
    setError("");
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function keepFocusInDialog(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href]",
    ) ?? []);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function submitReport() {
    if (submitting || !formRef.current?.reportValidity()) return;
    setSubmitting(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/categories/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: categorySlug, reason, detail }),
      });
      const parsed = parseApiResponse(await response.json(), parseCategoryReportReceipt);
      if (!parsed.ok) throw new Error(parsed.error.message);
      setDetail("");
      setMessage(`Report received for ${parsed.data.categoryTitle} version ${parsed.data.categoryVersion}. A moderator will review it privately.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The report could not be sent.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button ref={triggerRef} className="category-report-trigger" type="button" onClick={() => setOpen(true)}>
        Report a category problem
      </button>
      {open ? (
        <div className="category-report-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}>
          <section ref={dialogRef} className="category-report-dialog" role="dialog" aria-modal="true" aria-labelledby="category-report-title" aria-describedby="category-report-description" onKeyDown={keepFocusInDialog}>
            <header>
              <div>
                <h2 id="category-report-title">Report a category problem</h2>
                <p id="category-report-description">Tell us what should be reviewed. Your identity is never shown to moderators.</p>
              </div>
              <button ref={closeRef} type="button" aria-label="Close report dialog" onClick={closeDialog}>
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 4.5 11 11m0-11-11 11" /></svg>
              </button>
            </header>
            {message ? (
              <div className="category-report-success" role="status">
                <span aria-hidden="true">✓</span>
                <div><strong>Thank you.</strong><p>{message}</p></div>
                <button type="button" onClick={closeDialog}>Return to practice</button>
              </div>
            ) : (
              <form ref={formRef} onSubmit={(event) => { event.preventDefault(); void submitReport(); }}>
                <label>
                  <span>What seems wrong? <i aria-hidden="true">*</i></span>
                  <select value={reason} onChange={(event) => setReason(event.target.value as CategoryReportReason)} required>
                    {reasonOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>What should we check? <i aria-hidden="true">*</i></span>
                  <textarea
                    value={detail}
                    onChange={(event) => setDetail(event.target.value)}
                    minLength={20}
                    maxLength={800}
                    required
                    placeholder={`Describe the issue with ${categoryTitle}.`}
                  />
                  <small>{detail.length}/800 · minimum 20 characters</small>
                </label>
                <p className="category-report-boundary">A report does not remove the category or change its ranking. A moderator reviews it privately.</p>
                {error ? <p className="category-report-error" role="alert">{error}</p> : null}
                <div className="category-report-actions">
                  <button type="button" onClick={closeDialog} disabled={submitting}>Cancel</button>
                  <button type="submit" disabled={submitting}>{submitting ? "Sending…" : "Send report"}</button>
                </div>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
