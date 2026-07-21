"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import {
  parseCategoryPublicationPayload,
  parseCategoryPublicationQueuePayload,
  parseCategoryPublicationRelease,
} from "@/lib/category-publication-contract";
import type {
  CategoryPublicationInput,
  CategoryPublicationPayload,
  CategoryPublicationQueuePayload,
  CategoryPublicationRelease,
} from "@/lib/category-publication-types";
import type { CategoryBankPayload } from "@/lib/category-bank-types";
import { parseApiResponse } from "@/lib/daily-contract";

type WorkspaceView = "ready" | "published";
type Operation = "loading" | "publishing" | "requesting-correction" | null;

function getDraftLabel(prompt: string) {
  const match = prompt.match(/^How many (.+) can you name\??$/i);
  const label = match?.[1] ?? prompt;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function toSlug(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function publicationDefaults(bank: CategoryBankPayload, currentRelease?: CategoryPublicationRelease) {
  if (currentRelease) {
    return {
      title: currentRelease.title,
      slug: currentRelease.slug,
      summary: currentRelease.summary,
      coverageNote: currentRelease.coverageNote,
    };
  }
  const title = getDraftLabel(bank.prompt);
  return {
    title,
    slug: toSlug(title),
    summary: `A reviewed local-practice bank for ${title.toLowerCase()}.`,
    coverageNote: bank.coverageNotes.slice(0, 300),
  };
}

function acceptedNameCount(bank: CategoryBankPayload) {
  return bank.answers.reduce((total, answer) => total + 1 + answer.aliases.length, 0);
}

function formatUtc(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value)) + " UTC";
}

export function CategoryPublicationWorkspace({
  initialPayload,
}: {
  initialPayload: CategoryPublicationQueuePayload | null;
}) {
  const initialView: WorkspaceView = initialPayload?.banks.length ? "ready" : "published";
  const initialBank = initialPayload?.banks[0] ?? null;
  const initialRelease = initialPayload?.releases[0] ?? null;
  const [payload, setPayload] = useState(initialPayload);
  const [view, setView] = useState<WorkspaceView>(initialView);
  const [selectedBankId, setSelectedBankId] = useState(initialBank?.draftId ?? null);
  const [selectedReleaseId, setSelectedReleaseId] = useState(initialRelease?.publicationId ?? null);
  const [form, setForm] = useState<CategoryPublicationInput>(() => initialBank
    ? publicationDefaults(initialBank, initialPayload?.releases.find((release) => release.draftId === initialBank.draftId && release.current))
    : { title: "", slug: "", summary: "", coverageNote: "" });
  const [correctionReason, setCorrectionReason] = useState("");
  const [operation, setOperation] = useState<Operation>(null);
  const [publication, setPublication] = useState<CategoryPublicationPayload | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(initialPayload ? "" : "The release workspace could not be loaded.");
  const publicationFormRef = useRef<HTMLFormElement>(null);
  const correctionFormRef = useRef<HTMLFormElement>(null);
  const selectedBank = payload?.banks.find((bank) => bank.draftId === selectedBankId) ?? null;
  const selectedRelease = payload?.releases.find((release) => release.publicationId === selectedReleaseId) ?? null;

  function currentReleaseForBank(bank: CategoryBankPayload) {
    return payload?.releases.find((release) => release.draftId === bank.draftId && release.current);
  }

  function selectBank(bank: CategoryBankPayload) {
    setSelectedBankId(bank.draftId);
    setForm(publicationDefaults(bank, currentReleaseForBank(bank)));
    setPublication(null);
    setMessage("");
    setError("");
  }

  function selectRelease(release: CategoryPublicationRelease) {
    setSelectedReleaseId(release.publicationId);
    setCorrectionReason("");
    setMessage("");
    setError("");
  }

  async function fetchWorkspace() {
    const response = await fetch("/api/categories/banks/publishing", { cache: "no-store" });
    const parsed = parseApiResponse(await response.json(), parseCategoryPublicationQueuePayload);
    if (!parsed.ok) throw new Error(parsed.error.message);
    return parsed.data;
  }

  async function reloadQueue() {
    setOperation("loading");
    setError("");
    try {
      const next = await fetchWorkspace();
      const nextBank = next.banks[0] ?? null;
      const nextRelease = next.releases[0] ?? null;
      setPayload(next);
      setSelectedBankId(nextBank?.draftId ?? null);
      setSelectedReleaseId(nextRelease?.publicationId ?? null);
      setForm(nextBank ? publicationDefaults(nextBank, next.releases.find((release) => release.draftId === nextBank.draftId && release.current)) : { title: "", slug: "", summary: "", coverageNote: "" });
      setView(next.banks.length ? "ready" : "published");
      setPublication(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The release workspace could not be loaded.");
    } finally {
      setOperation(null);
    }
  }

  async function publish() {
    if (!selectedBank || operation || !publicationFormRef.current?.reportValidity()) return;
    setOperation("publishing");
    setError("");
    setMessage("");
    setPublication(null);
    try {
      const response = await fetch(`/api/categories/banks/${selectedBank.draftId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const parsed = parseApiResponse(await response.json(), parseCategoryPublicationPayload);
      if (!parsed.ok) throw new Error(parsed.error.message);
      const next = await fetchWorkspace();
      setPayload(next);
      setSelectedBankId(next.banks[0]?.draftId ?? null);
      setSelectedReleaseId(parsed.data.publicationId);
      setPublication(parsed.data);
      setView("published");
      setMessage(parsed.data.supersededPublicationId
        ? `Category version ${parsed.data.categoryVersion} is now the current unranked practice release.`
        : "Published as reviewed, unranked practice.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The approved bank could not be published.");
    } finally {
      setOperation(null);
    }
  }

  async function requestCorrection() {
    if (!selectedRelease?.current || selectedRelease.correctionRequest || operation
      || !correctionFormRef.current?.reportValidity()) return;
    setOperation("requesting-correction");
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/categories/banks/publications/${selectedRelease.publicationId}/corrections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: correctionReason }),
      });
      const parsed = parseApiResponse(await response.json(), parseCategoryPublicationRelease);
      if (!parsed.ok) throw new Error(parsed.error.message);
      setPayload((current) => current ? {
        ...current,
        releases: current.releases.map((release) => release.publicationId === parsed.data.publicationId ? parsed.data : release),
      } : current);
      setCorrectionReason("");
      setMessage("Correction requested. The current practice release remains live while a new revision is reviewed.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The correction request could not be recorded.");
    } finally {
      setOperation(null);
    }
  }

  if (payload && !payload.authorized) {
    return <section className="draft-frame"><PublicationHeader /><section className="review-access-boundary"><h1>Publisher access required.</h1><p>This private release workspace is available only to explicitly assigned publishers.</p><Link href="/">Return to NameMore</Link></section></section>;
  }

  if (!payload) {
    return <section className="draft-frame"><PublicationHeader /><section className="review-access-boundary"><h1>Publishing unavailable.</h1><p>{error}</p><button type="button" disabled={operation === "loading"} onClick={() => void reloadQueue()}>{operation === "loading" ? "Retrying…" : "Retry"}</button></section></section>;
  }

  return (
    <section className="draft-frame">
      <PublicationHeader />
      <div className="publication-workspace">
        <aside className="publication-rail" aria-label="Release workspace">
          <h1>Release workspace</h1>
          <div className="publication-tabs" role="tablist" aria-label="Release views">
            <button type="button" role="tab" aria-selected={view === "ready"} onClick={() => setView("ready")}>Ready to publish</button>
            <button type="button" role="tab" aria-selected={view === "published"} onClick={() => setView("published")}>Published</button>
          </div>
          <div className="publication-list">
            {view === "ready" ? payload.banks.map((bank) => (
              <button key={`${bank.draftId}-${bank.revision}`} type="button" className={bank.draftId === selectedBankId ? "is-selected" : undefined} onClick={() => selectBank(bank)} aria-current={bank.draftId === selectedBankId ? "true" : undefined}>
                <span><strong>{getDraftLabel(bank.prompt)}</strong><small>Revision {bank.revision} · Approved</small></span>
              </button>
            )) : payload.releases.map((release) => (
              <button key={release.publicationId} type="button" className={release.publicationId === selectedReleaseId ? "is-selected" : undefined} onClick={() => selectRelease(release)} aria-current={release.publicationId === selectedReleaseId ? "true" : undefined}>
                <span><strong>{release.title}</strong><small>Version {release.categoryVersion} · {release.current ? "Current practice" : "Superseded"}</small></span>
                <span className={release.current ? "publication-state is-current" : "publication-state"} aria-hidden="true">{release.current ? "✓" : "◷"}</span>
              </button>
            ))}
          </div>
          {view === "ready" && payload.banks.length === 0 ? <p className="publication-empty">No approved banks are waiting to publish.</p> : null}
          {view === "published" && payload.releases.length === 0 ? <p className="publication-empty">No practice releases have been published.</p> : null}
          <Link className="publication-back-link" href="/review/banks/decisions">← <span>Return to bank decisions</span></Link>
        </aside>

        <main className="publication-detail">
          {view === "ready" ? <ReadyRelease
            selected={selectedBank}
            form={form}
            setForm={setForm}
            formRef={publicationFormRef}
            operation={operation}
            publish={publish}
          /> : <PublishedRelease
            release={selectedRelease}
            correctionReason={correctionReason}
            setCorrectionReason={setCorrectionReason}
            formRef={correctionFormRef}
            operation={operation}
            requestCorrection={requestCorrection}
          />}
          {publication ? <p className="publication-message" role="status">{message} <Link href={`/practice/${publication.slug}`}>Open practice category</Link></p> : message ? <p className="publication-message" role="status">{message}</p> : null}
          {error ? <p className="review-message is-error" role="alert">{error}</p> : null}
        </main>

        <aside className="publication-boundary">
          <h2>{view === "published" ? "Immutable release boundary" : "Release boundary"}</h2>
          <p>{view === "published" ? "Published versions are never overwritten." : "Publishing makes an approved version discoverable and playable in local practice."}</p>
          <ul>
            <li><span aria-hidden="true">✓</span>{view === "published" ? "Current practice remains live" : "Publisher authority verified"}</li>
            <li><span aria-hidden="true">✓</span>{view === "published" ? "New bank revision required" : "Approved revision locked"}</li>
            <li><span aria-hidden="true">✓</span>{view === "published" ? "Independent approval required" : "Immutable version prepared"}</li>
            <li><span aria-hidden="true">✓</span>{view === "published" ? "Ranked eligibility unchanged" : "Competitive play still blocked"}</li>
          </ul>
          <Link className="publication-back-link publication-back-link-mobile" href="/review/banks/decisions">← <span>Return to bank decisions</span></Link>
        </aside>
      </div>
    </section>
  );
}

function ReadyRelease({
  selected,
  form,
  setForm,
  formRef,
  operation,
  publish,
}: {
  selected: CategoryBankPayload | null;
  form: CategoryPublicationInput;
  setForm: React.Dispatch<React.SetStateAction<CategoryPublicationInput>>;
  formRef: React.RefObject<HTMLFormElement | null>;
  operation: Operation;
  publish: () => Promise<void>;
}) {
  return <>
    <h2>Prepare the reviewed practice release.</h2>
    {selected ? <form ref={formRef} className="publication-form" onSubmit={(event) => { event.preventDefault(); void publish(); }}>
      <div className="publication-evidence">
        <EvidenceRow label="Approved prompt" value={selected.prompt} />
        <EvidenceRow label="Bank revision" value={`Revision ${selected.revision}`} />
        <EvidenceRow label="Answer bank" value={`${selected.answers.length} canonical answers · ${acceptedNameCount(selected)} accepted names`} />
        <EvidenceRow label="Provenance" value={selected.sourceLabel ?? "—"} href={selected.sourceUrl ?? undefined} />
      </div>
      <label>Practice title<input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} minLength={2} maxLength={120} required /></label>
      <label>URL slug<input value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value.toLowerCase() }))} minLength={3} maxLength={80} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required spellCheck="false" /></label>
      <label>Catalog summary<textarea value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} minLength={8} maxLength={240} required /></label>
      <label>Coverage note<textarea value={form.coverageNote} onChange={(event) => setForm((current) => ({ ...current, coverageNote: event.target.value }))} minLength={8} maxLength={300} required /></label>
      <button className="publication-submit" type="submit" disabled={operation !== null}>{operation === "publishing" ? "Publishing…" : "Publish unranked practice"}</button>
    </form> : <div className="bank-start"><h3>No approved banks are waiting.</h3><p>A bank appears here only after an independent reviewer approves its frozen revision.</p></div>}
  </>;
}

function PublishedRelease({
  release,
  correctionReason,
  setCorrectionReason,
  formRef,
  operation,
  requestCorrection,
}: {
  release: CategoryPublicationRelease | null;
  correctionReason: string;
  setCorrectionReason: (value: string) => void;
  formRef: React.RefObject<HTMLFormElement | null>;
  operation: Operation;
  requestCorrection: () => Promise<void>;
}) {
  return <>
    <h2>Published release history.</h2>
    {release ? <>
      <section className="release-ledger" aria-label={`${release.title} version ${release.categoryVersion}`}>
        <header><strong>{release.title}</strong><span>Version {release.categoryVersion} · {release.current ? "Current practice" : "Superseded"}</span>{release.current ? <small><i />Live</small> : null}</header>
        <EvidenceRow label="Practice title" value={release.title} />
        <EvidenceRow label="URL slug" value={release.slug} />
        <EvidenceRow label="Category version" value={String(release.categoryVersion)} />
        <EvidenceRow label="Bank revision" value={String(release.bankRevision)} />
        <EvidenceRow label="Published" value={formatUtc(release.publishedAt)} />
        <EvidenceRow label="Provenance" value={release.sourceLabel} href={release.sourceUrl} />
        <EvidenceRow label="Answer bank" value={`${release.answerCount} canonical answers · ${release.acceptedNameCount} accepted names`} />
        <EvidenceRow label="Competitive eligibility" value="Not eligible · Practice only" />
      </section>
      {release.current ? <section className="release-correction">
        <h3>Request a correction</h3>
        <p>The current practice stays live while a new revision is independently reviewed.</p>
        {release.correctionRequest ? <CorrectionState release={release} /> : <form ref={formRef} onSubmit={(event) => { event.preventDefault(); void requestCorrection(); }}>
          <label><span className="release-correction-label">Correction reason <i aria-hidden="true">*</i></span><textarea value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} minLength={12} maxLength={1000} required placeholder="Describe the issue and the correction you’re requesting…" /></label>
          <div className="release-correction-count" aria-hidden="true">{correctionReason.length}/1000</div>
          <button className="release-correction-submit" type="submit" disabled={operation !== null}>{operation === "requesting-correction" ? "Requesting…" : "Request correction"}</button>
        </form>}
      </section> : <p className="release-superseded-note">This immutable version remains in the ledger. Corrections are requested against the current practice release.</p>}
    </> : <div className="bank-start"><h3>No published releases yet.</h3><p>Approved banks appear in the release ledger after a separate publisher makes them available for unranked practice.</p></div>}
  </>;
}

function CorrectionState({ release }: { release: CategoryPublicationRelease }) {
  const correction = release.correctionRequest;
  if (!correction) return null;
  const state = correction.successorPublished ? "Successor published" : correction.revisionStarted ? "Revision in review" : "Correction pending";
  return <div className="release-correction-state" role="status">
    <span aria-hidden="true">◷</span>
    <div><strong>{state}</strong><time dateTime={correction.requestedAt}>{formatUtc(correction.requestedAt)}</time><p>{correction.reason}</p></div>
  </div>;
}

function EvidenceRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return <div className="publication-evidence-row"><span>{label}</span><output>{href ? <a href={href} target="_blank" rel="noreferrer">{value}</a> : value}</output></div>;
}

function PublicationHeader() {
  return <header className="discovery-header"><Link className="brand" href="/">NameMore</Link><nav aria-label="Primary navigation"><Link href="/daily">Daily</Link><Link href="/room">Private rooms</Link></nav></header>;
}
