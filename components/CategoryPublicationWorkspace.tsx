"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import {
  parseCategoryPublicationPayload,
  parseCategoryPublicationQueuePayload,
} from "@/lib/category-publication-contract";
import type {
  CategoryPublicationInput,
  CategoryPublicationPayload,
  CategoryPublicationQueuePayload,
} from "@/lib/category-publication-types";
import type { CategoryBankPayload } from "@/lib/category-bank-types";
import { parseApiResponse } from "@/lib/daily-contract";

function getDraftLabel(prompt: string) {
  const match = prompt.match(/^How many (.+) can you name\??$/i);
  const label = match?.[1] ?? prompt;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function toSlug(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function publicationDefaults(bank: CategoryBankPayload): CategoryPublicationInput {
  const title = getDraftLabel(bank.prompt);
  const coverageNote = bank.coverageNotes.slice(0, 300);
  return {
    title,
    slug: toSlug(title),
    summary: `A reviewed local-practice bank for ${title.toLowerCase()}.`,
    coverageNote,
  };
}

function acceptedNameCount(bank: CategoryBankPayload) {
  return bank.answers.reduce((total, answer) => total + 1 + answer.aliases.length, 0);
}

export function CategoryPublicationWorkspace({
  initialPayload,
}: {
  initialPayload: CategoryPublicationQueuePayload | null;
}) {
  const [payload, setPayload] = useState(initialPayload);
  const [selectedId, setSelectedId] = useState(initialPayload?.banks[0]?.draftId ?? null);
  const initialBank = initialPayload?.banks[0] ?? null;
  const [form, setForm] = useState<CategoryPublicationInput>(() => initialBank
    ? publicationDefaults(initialBank)
    : { title: "", slug: "", summary: "", coverageNote: "" });
  const [operation, setOperation] = useState<"loading" | "publishing" | null>(null);
  const [publication, setPublication] = useState<CategoryPublicationPayload | null>(null);
  const [error, setError] = useState(initialPayload ? "" : "The publishing queue could not be loaded.");
  const formRef = useRef<HTMLFormElement>(null);
  const selected = payload?.banks.find((bank) => bank.draftId === selectedId) ?? null;

  function selectBank(bank: CategoryBankPayload) {
    setSelectedId(bank.draftId);
    setForm(publicationDefaults(bank));
    setPublication(null);
    setError("");
  }

  async function reloadQueue() {
    setOperation("loading");
    setError("");
    try {
      const response = await fetch("/api/categories/banks/publishing", { cache: "no-store" });
      const parsed = parseApiResponse(await response.json(), parseCategoryPublicationQueuePayload);
      if (!parsed.ok) throw new Error(parsed.error.message);
      const first = parsed.data.banks[0] ?? null;
      setPayload(parsed.data);
      setSelectedId(first?.draftId ?? null);
      setForm(first ? publicationDefaults(first) : { title: "", slug: "", summary: "", coverageNote: "" });
      setPublication(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The publishing queue could not be loaded.");
    } finally {
      setOperation(null);
    }
  }

  async function publish() {
    if (!selected || operation || !formRef.current?.reportValidity()) return;
    setOperation("publishing");
    setError("");
    setPublication(null);
    try {
      const response = await fetch(`/api/categories/banks/${selected.draftId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const parsed = parseApiResponse(await response.json(), parseCategoryPublicationPayload);
      if (!parsed.ok) throw new Error(parsed.error.message);
      const nextBanks = payload?.banks.filter((bank) => bank.draftId !== selected.draftId) ?? [];
      const nextBank = nextBanks[0] ?? null;
      setPayload((current) => current ? { ...current, banks: nextBanks } : current);
      setSelectedId(nextBank?.draftId ?? null);
      setForm(nextBank ? publicationDefaults(nextBank) : { title: "", slug: "", summary: "", coverageNote: "" });
      setPublication(parsed.data);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The approved bank could not be published.");
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
        <aside className="publication-rail" aria-label="Publishing queue">
          <h1>Publishing queue</h1>
          <div className="publication-list">
            {payload.banks.map((bank) => (
              <button key={`${bank.draftId}-${bank.revision}`} type="button" className={bank.draftId === selectedId ? "is-selected" : undefined} onClick={() => selectBank(bank)} aria-current={bank.draftId === selectedId ? "true" : undefined}>
                <span><strong>{getDraftLabel(bank.prompt)}</strong><small>Revision {bank.revision} · Bank approved</small></span>
              </button>
            ))}
          </div>
          {payload.banks.length === 0 ? <p className="publication-empty">No approved banks are waiting to publish.</p> : null}
          <Link className="publication-back-link" href="/review/banks/decisions">← <span>Return to bank decisions</span></Link>
        </aside>

        <main className="publication-detail">
          <h2>Prepare the reviewed practice release.</h2>
          {selected ? (
            <form ref={formRef} className="publication-form" onSubmit={(event) => { event.preventDefault(); void publish(); }}>
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
            </form>
          ) : <div className="bank-start"><h3>No approved banks are waiting.</h3><p>A bank appears here only after an independent reviewer approves its frozen revision.</p></div>}
          {publication ? <p className="publication-message" role="status">Published as reviewed, unranked practice. <Link href={`/practice/${publication.slug}`}>Open practice category</Link></p> : null}
          {error ? <p className="review-message is-error" role="alert">{error}</p> : null}
        </main>

        <aside className="publication-boundary">
          <h2>Release boundary</h2>
          <p>Publishing makes this approved version discoverable and playable in local practice.</p>
          <p>It does not grant daily, leaderboard, room, or ranked eligibility.</p>
          <ul><li><span aria-hidden="true">✓</span> Publisher authority verified</li><li><span aria-hidden="true">✓</span> Approved revision locked</li><li><span aria-hidden="true">✓</span> Immutable version prepared</li><li><span aria-hidden="true">✓</span> Competitive play still blocked</li></ul>
          <Link className="publication-back-link publication-back-link-mobile" href="/review/banks/decisions">← <span>Return to bank decisions</span></Link>
        </aside>
      </div>
    </section>
  );
}

function EvidenceRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return <div className="publication-evidence-row"><span>{label}</span><output>{href ? <a href={href} target="_blank" rel="noreferrer">{value}</a> : value}</output></div>;
}

function PublicationHeader() {
  return <header className="discovery-header"><Link className="brand" href="/">NameMore</Link><nav aria-label="Primary navigation"><Link href="/daily">Daily</Link><Link href="/room">Private rooms</Link></nav></header>;
}
