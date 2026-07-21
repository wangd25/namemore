"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import {
  parseCategoryModerationDecisionPayload,
  parseCategoryModerationQueuePayload,
} from "@/lib/category-moderation-contract";
import type {
  CategoryModerationOutcome,
  CategoryModerationQueueItem,
  CategoryModerationQueuePayload,
  CategoryReportReason,
} from "@/lib/category-moderation-types";
import { parseApiResponse } from "@/lib/daily-contract";

type ModerationView = "pending" | "reviewed";
type Operation = CategoryModerationOutcome | "loading" | null;

const reasonLabels: Record<CategoryReportReason, string> = {
  "answer-bank-accuracy": "Answer-bank accuracy",
  "coverage-or-wording": "Coverage or wording",
  "provenance-or-copyright": "Provenance or copyright",
  "offensive-or-unsafe": "Offensive or unsafe content",
  other: "Something else",
};

function formatUtc(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value)) + " UTC";
}

function formatAge(serverNow: string, value: string) {
  const minutes = Math.max(0, Math.floor((Date.parse(serverNow) - Date.parse(value)) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function reportsForView(payload: CategoryModerationQueuePayload, view: ModerationView) {
  return payload.reports.filter((report) => view === "pending" ? report.status === "pending" : report.status !== "pending");
}

export function CategoryModerationWorkspace({
  initialPayload,
}: {
  initialPayload: CategoryModerationQueuePayload | null;
}) {
  const initialView: ModerationView = initialPayload?.reports.some((report) => report.status === "pending") ? "pending" : "reviewed";
  const [payload, setPayload] = useState(initialPayload);
  const [view, setView] = useState<ModerationView>(initialView);
  const [selectedId, setSelectedId] = useState(() => initialPayload ? reportsForView(initialPayload, initialView)[0]?.reportId ?? null : null);
  const [note, setNote] = useState("");
  const [operation, setOperation] = useState<Operation>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(initialPayload ? "" : "The moderation workspace could not be loaded.");
  const formRef = useRef<HTMLFormElement>(null);
  const visibleReports = payload ? reportsForView(payload, view) : [];
  const selected = payload?.reports.find((report) => report.reportId === selectedId) ?? null;

  function chooseView(nextView: ModerationView) {
    if (!payload) return;
    setView(nextView);
    setSelectedId(reportsForView(payload, nextView)[0]?.reportId ?? null);
    setNote("");
    setMessage("");
    setError("");
  }

  function selectReport(report: CategoryModerationQueueItem) {
    setSelectedId(report.reportId);
    setNote("");
    setMessage("");
    setError("");
  }

  async function reloadQueue() {
    setOperation("loading");
    setError("");
    try {
      const response = await fetch("/api/categories/moderation", { cache: "no-store" });
      const parsed = parseApiResponse(await response.json(), parseCategoryModerationQueuePayload);
      if (!parsed.ok) throw new Error(parsed.error.message);
      const nextView: ModerationView = parsed.data.reports.some((report) => report.status === "pending") ? "pending" : "reviewed";
      setPayload(parsed.data);
      setView(nextView);
      setSelectedId(reportsForView(parsed.data, nextView)[0]?.reportId ?? null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The moderation workspace could not be loaded.");
    } finally {
      setOperation(null);
    }
  }

  async function decide(outcome: CategoryModerationOutcome) {
    if (!payload || !selected || selected.status !== "pending" || operation || !formRef.current?.reportValidity()) return;
    setOperation(outcome);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/categories/moderation/${selected.reportId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, note }),
      });
      const parsed = parseApiResponse(await response.json(), parseCategoryModerationDecisionPayload);
      if (!parsed.ok) throw new Error(parsed.error.message);
      const nextReports = payload.reports.map((report) => report.reportId === selected.reportId ? {
        ...report,
        status: parsed.data.status,
        decision: { outcome: parsed.data.outcome, note: note.trim().replace(/\s+/g, " "), decidedAt: parsed.data.decidedAt },
      } : report);
      const nextPayload = { ...payload, reports: nextReports };
      const remaining = reportsForView(nextPayload, "pending");
      setPayload(nextPayload);
      setSelectedId(remaining[0]?.reportId ?? null);
      setNote("");
      setMessage(outcome === "dismiss"
        ? "Report dismissed. The decision was recorded without changing the category."
        : "Sent to publisher review. The live category remains unchanged.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The moderation decision could not be recorded.");
    } finally {
      setOperation(null);
    }
  }

  if (payload && !payload.authorized) {
    return <section className="draft-frame"><ModerationHeader /><section className="review-access-boundary"><h1>Moderator access required.</h1><p>This private workspace is available only to explicitly assigned moderators.</p><Link href="/">Return to NameMore</Link></section></section>;
  }

  if (!payload) {
    return <section className="draft-frame"><ModerationHeader /><section className="review-access-boundary"><h1>Moderation unavailable.</h1><p>{error}</p><button type="button" disabled={operation === "loading"} onClick={() => void reloadQueue()}>{operation === "loading" ? "Retrying…" : "Retry"}</button></section></section>;
  }

  return (
    <section className="draft-frame">
      <ModerationHeader />
      <div className="moderation-workspace">
        <aside className="moderation-queue" aria-label="Moderation queue">
          <h1>Moderation queue</h1>
          <div className="moderation-tabs" role="tablist" aria-label="Report views">
            <button type="button" role="tab" aria-selected={view === "pending"} onClick={() => chooseView("pending")}>Pending</button>
            <button type="button" role="tab" aria-selected={view === "reviewed"} onClick={() => chooseView("reviewed")}>Reviewed</button>
          </div>
          <div className="moderation-list">
            {visibleReports.map((report) => (
              <button key={report.reportId} type="button" className={report.reportId === selectedId ? "is-selected" : undefined} onClick={() => selectReport(report)} aria-current={report.reportId === selectedId ? "true" : undefined}>
                <span><strong>{report.categoryTitle}</strong><small>{reasonLabels[report.reason]} · {formatAge(payload.serverNow, report.reportedAt)}</small></span>
                <i className={report.status === "pending" ? "is-pending" : undefined} aria-hidden="true" />
              </button>
            ))}
          </div>
          {visibleReports.length === 0 ? <p className="moderation-empty">No {view} category reports.</p> : null}
          <Link className="moderation-back-link" href="/review">Return to review workspaces</Link>
        </aside>

        <section className="moderation-detail">
          <h2>Review a category report.</h2>
          <p className="moderation-intro">Assess the report without exposing the reporter or changing the live category.</p>
          {selected ? <>
            <dl className="moderation-evidence">
              <div><dt>Category</dt><dd>{selected.categoryTitle}</dd></div>
              <div><dt>Current release</dt><dd>Version {selected.categoryVersion} · {selected.availability === "daily" ? "Daily" : "Practice only"}</dd></div>
              <div><dt>Reported</dt><dd>{formatUtc(selected.reportedAt)}</dd></div>
              <div><dt>Reason</dt><dd>{reasonLabels[selected.reason]}</dd></div>
              <div><dt>Report detail</dt><dd>{selected.detail}</dd></div>
            </dl>
            {selected.status === "pending" ? <form ref={formRef} className="moderation-form" onSubmit={(event) => { event.preventDefault(); void decide("publisher-review"); }}>
              <h3>Moderator decision</h3>
              <label><span>Internal decision note <i aria-hidden="true">*</i></span><textarea value={note} onChange={(event) => setNote(event.target.value)} minLength={12} maxLength={600} required placeholder="Record the reason for this decision." /></label>
              <div className="moderation-actions"><button type="button" disabled={operation !== null} onClick={() => void decide("dismiss")}>{operation === "dismiss" ? "Recording…" : "Dismiss report"}</button><button type="submit" disabled={operation !== null}>{operation === "publisher-review" ? "Sending…" : "Send to publisher review"}</button></div>
              <p>Neither decision changes the live category.</p>
            </form> : <section className="moderation-reviewed-state"><h3>{selected.status === "dismissed" ? "Report dismissed" : "Sent to publisher review"}</h3><p>{selected.decision?.note}</p><time dateTime={selected.decision?.decidedAt}>{selected.decision ? formatUtc(selected.decision.decidedAt) : null}</time></section>}
          </> : <div className="moderation-clear"><h3>The queue is clear.</h3><p>No reports in this view need attention.</p></div>}
          {message ? <p className="moderation-message is-success" role="status">{message}</p> : null}
          {error ? <p className="moderation-message is-error" role="alert">{error}</p> : null}
        </section>

        <aside className="moderation-boundary">
          <h2>Moderation boundary</h2>
          <p>Reports are private signals, not automatic enforcement.</p>
          <ul>
            <li><span aria-hidden="true">✓</span>Reporter identity stays private</li>
            <li><span aria-hidden="true">✓</span>Live practice remains available</li>
            <li><span aria-hidden="true">✓</span>Publisher correction stays separate</li>
            <li><span aria-hidden="true">✓</span>Ranked eligibility cannot change</li>
          </ul>
        </aside>
      </div>
    </section>
  );
}

function ModerationHeader() {
  return <header className="discovery-header"><Link className="brand" href="/">NameMore</Link><nav aria-label="Primary navigation"><Link href="/daily">Daily</Link><Link href="/room">Private rooms</Link></nav></header>;
}
