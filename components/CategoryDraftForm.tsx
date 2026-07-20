"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import { parseCategoryDraftPayload } from "@/lib/category-discovery-contract";
import { parseApiResponse } from "@/lib/daily-contract";

export function CategoryDraftForm({ initialPrompt }: { initialPrompt: string }) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [sourceNotes, setSourceNotes] = useState("");
  const [coverageNotes, setCoverageNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");
    try {
      const response = await fetch("/api/categories/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, sourceNotes, coverageNotes }),
      });
      const parsed = parseApiResponse(await response.json(), parseCategoryDraftPayload);
      if (!parsed.ok) throw new Error(parsed.error.message);
      setStatus("saved");
      setMessage("Draft saved privately. It remains unreviewed, practice-only, and unranked.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "The draft could not be saved.");
    }
  }

  return (
    <section className="draft-frame">
      <header className="discovery-header">
        <Link className="brand" href="/">NameMore</Link>
        <nav aria-label="Primary navigation">
          <Link href="/daily">Daily</Link>
          <Link href="/room">Private rooms</Link>
        </nav>
      </header>
      <div className="draft-content">
        <div className="draft-copy">
          <span>Practice draft</span>
          <h1>Shape a category before it becomes a game.</h1>
          <p>
            Drafts are private working notes. They cannot enter the daily challenge,
            leaderboards, or room play until a versioned answer bank is reviewed.
          </p>
        </div>
        <form className="draft-form" onSubmit={handleSubmit}>
          <label>
            Category prompt
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              minLength={4}
              maxLength={160}
              required
            />
          </label>
          <label>
            Source or provenance
            <textarea
              value={sourceNotes}
              onChange={(event) => setSourceNotes(event.target.value)}
              placeholder="Where should the answer bank come from?"
              minLength={8}
              maxLength={500}
              required
            />
          </label>
          <label>
            Coverage boundaries
            <textarea
              value={coverageNotes}
              onChange={(event) => setCoverageNotes(event.target.value)}
              placeholder="What counts, what does not, and where could the list be incomplete?"
              minLength={8}
              maxLength={500}
              required
            />
          </label>
          <div className="draft-safety-note">
            <strong>Unreviewed · practice-only</strong>
            <span>No generated answer bank is treated as exhaustive or rank-eligible.</span>
          </div>
          <button className="composer-primary-action" type="submit" disabled={status === "saving" || status === "saved"}>
            {status === "saving" ? "Saving draft…" : status === "saved" ? "Draft saved" : "Save private draft"}
          </button>
          {message ? <p className={`draft-status is-${status}`} role="status">{message}</p> : null}
        </form>
      </div>
    </section>
  );
}
