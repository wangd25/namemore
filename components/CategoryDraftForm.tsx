"use client";

import Link from "next/link";
import {
  type FormEvent,
  useCallback,
  useRef,
  useState,
} from "react";

import {
  parseCategoryDraftListPayload,
  parseCategoryDraftPayload,
} from "@/lib/category-discovery-contract";
import type {
  CategoryDraftListPayload,
  CategoryDraftPayload,
} from "@/lib/category-discovery-types";
import { parseApiResponse } from "@/lib/daily-contract";

type DraftFields = {
  prompt: string;
  sourceNotes: string;
  coverageNotes: string;
};

type Operation = "idle" | "saving" | "submitting";

const blankFields: DraftFields = {
  prompt: "",
  sourceNotes: "",
  coverageNotes: "",
};

function fieldsFromDraft(draft: CategoryDraftPayload): DraftFields {
  return {
    prompt: draft.prompt,
    sourceNotes: draft.sourceNotes,
    coverageNotes: draft.coverageNotes,
  };
}

function getDraftLabel(prompt: string) {
  const match = prompt.match(/^How many (.+) can you name\??$/i);
  const label = match?.[1] ?? prompt;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getDraftStateLabel(draft: CategoryDraftPayload) {
  if (draft.reviewStatus === "changes-requested") return "Changes requested";
  if (draft.reviewStatus === "pending") return "Pending review";
  if (draft.reviewStatus === "scope-approved") return "Scope approved";
  if (draft.reviewStatus === "rejected") return "Rejected";
  return "Draft";
}

function sameFields(draft: CategoryDraftPayload, fields: DraftFields) {
  return draft.prompt === fields.prompt
    && draft.sourceNotes === fields.sourceNotes
    && draft.coverageNotes === fields.coverageNotes;
}

function upsertDraft(
  drafts: CategoryDraftPayload[],
  nextDraft: CategoryDraftPayload,
) {
  const existingIndex = drafts.findIndex((draft) => draft.id === nextDraft.id);
  if (existingIndex === -1) return [nextDraft, ...drafts];
  return drafts.map((draft) => draft.id === nextDraft.id ? nextDraft : draft);
}

export function CategoryDraftForm({
  initialPrompt,
  initialPayload,
}: {
  initialPrompt: string;
  initialPayload: CategoryDraftListPayload | null;
}) {
  const initialDraft = initialPrompt ? undefined : initialPayload?.drafts[0];
  const [drafts, setDrafts] = useState<CategoryDraftPayload[]>(
    () => initialPayload?.drafts ?? [],
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    initialDraft?.id ?? null,
  );
  const [fields, setFields] = useState<DraftFields>(() => initialDraft
    ? fieldsFromDraft(initialDraft)
    : { ...blankFields, prompt: initialPrompt });
  const [operation, setOperation] = useState<Operation>("idle");
  const [loadState, setLoadState] = useState<"ready" | "loading" | "error">(
    initialPayload ? "ready" : "error",
  );
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const formRef = useRef<HTMLFormElement>(null);

  const selectedDraft = drafts.find((draft) => draft.id === selectedId);
  const editingLocked = selectedDraft ? selectedDraft.status !== "draft" : false;
  const isDirty = selectedDraft ? !sameFields(selectedDraft, fields) : Object.values(fields).some(Boolean);

  const loadDrafts = useCallback(async () => {
    setLoadState("loading");
    try {
      const response = await fetch("/api/categories/drafts", { cache: "no-store" });
      const parsed = parseApiResponse(
        await response.json(),
        parseCategoryDraftListPayload,
      );
      if (!parsed.ok) throw new Error(parsed.error.message);
      setDrafts(parsed.data.drafts);
      setLoadState("ready");
      const firstDraft = parsed.data.drafts[0];
      setSelectedId((currentId) => {
        if (!initialPrompt && !currentId && firstDraft) {
          setFields(fieldsFromDraft(firstDraft));
          return firstDraft.id;
        }
        return currentId;
      });
    } catch (error) {
      setLoadState("error");
      setMessage(error instanceof Error ? error.message : "Your drafts could not be loaded.");
      setMessageTone("error");
    }
  }, [initialPrompt]);

  function selectDraft(draft: CategoryDraftPayload) {
    setSelectedId(draft.id);
    setFields(fieldsFromDraft(draft));
    setMessage("");
  }

  function startNewDraft() {
    setSelectedId(null);
    setFields(blankFields);
    setMessage("");
    requestAnimationFrame(() => formRef.current?.querySelector("textarea")?.focus());
  }

  function updateField(key: keyof DraftFields, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
    setMessage("");
  }

  async function persistDraft() {
    const response = await fetch(
      selectedDraft ? `/api/categories/drafts/${selectedDraft.id}` : "/api/categories/drafts",
      {
        method: selectedDraft ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      },
    );
    const parsed = parseApiResponse(await response.json(), parseCategoryDraftPayload);
    if (!parsed.ok) throw new Error(parsed.error.message);
    setDrafts((current) => upsertDraft(current, parsed.data));
    setSelectedId(parsed.data.id);
    setFields(fieldsFromDraft(parsed.data));
    return parsed.data;
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingLocked || operation !== "idle") return;
    setOperation("saving");
    setMessage("");
    try {
      await persistDraft();
      setMessage("Changes saved privately.");
      setMessageTone("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The draft could not be saved.");
      setMessageTone("error");
    } finally {
      setOperation("idle");
    }
  }

  async function handleSubmitForReview() {
    if (editingLocked || operation !== "idle") return;
    if (!formRef.current?.reportValidity()) return;
    setOperation("submitting");
    setMessage("");
    try {
      const savedDraft = !selectedDraft || isDirty
        ? await persistDraft()
        : selectedDraft;
      const response = await fetch(
        `/api/categories/drafts/${savedDraft.id}/submit`,
        { method: "POST" },
      );
      const parsed = parseApiResponse(await response.json(), parseCategoryDraftPayload);
      if (!parsed.ok) throw new Error(parsed.error.message);
      setDrafts((current) => upsertDraft(current, parsed.data));
      setSelectedId(parsed.data.id);
      setFields(fieldsFromDraft(parsed.data));
      setMessage("Submitted for review. Editing is now locked.");
      setMessageTone("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The review request could not be submitted.");
      setMessageTone("error");
    } finally {
      setOperation("idle");
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

      <div className="draft-workspace">
        <aside className="draft-rail" aria-label="Your category drafts">
          <div className="draft-rail-heading">
            <h1>Your drafts</h1>
            <button type="button" onClick={startNewDraft}>
              <span aria-hidden="true">+</span> New draft
            </button>
          </div>

          {loadState === "loading" ? <p className="draft-rail-message">Loading private drafts…</p> : null}
          {loadState === "error" ? (
            <div className="draft-rail-message is-error">
              <span>Drafts unavailable.</span>
              <button type="button" onClick={() => void loadDrafts()}>Retry</button>
            </div>
          ) : null}
          {loadState === "ready" && drafts.length === 0 ? (
            <p className="draft-rail-message">No saved drafts yet.</p>
          ) : null}

          <div className="draft-list">
            {drafts.map((draft) => (
              <button
                className={draft.id === selectedId ? "is-selected" : undefined}
                type="button"
                key={draft.id}
                onClick={() => selectDraft(draft)}
                aria-current={draft.id === selectedId ? "true" : undefined}
              >
                <span className="draft-list-copy">
                  <strong>{getDraftLabel(draft.prompt)}</strong>
                  <small>{getDraftStateLabel(draft)}</small>
                </span>
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="m7 4 6 6-6 6" />
                </svg>
              </button>
            ))}
          </div>
        </aside>

        <section className="draft-editor">
          <h2>Hone the boundaries before review.</h2>
          <form className="draft-form" ref={formRef} onSubmit={handleSave}>
            <label>
              Category prompt
              <textarea
                value={fields.prompt}
                onChange={(event) => updateField("prompt", event.target.value)}
                placeholder="How many European capitals can you name?"
                minLength={4}
                maxLength={160}
                required
                readOnly={editingLocked}
              />
            </label>
            <label>
              Source or provenance
              <textarea
                value={fields.sourceNotes}
                onChange={(event) => updateField("sourceNotes", event.target.value)}
                placeholder="Where should the answer bank come from?"
                minLength={8}
                maxLength={500}
                required
                readOnly={editingLocked}
              />
            </label>
            <label>
              Coverage boundaries
              <textarea
                value={fields.coverageNotes}
                onChange={(event) => updateField("coverageNotes", event.target.value)}
                placeholder="What counts, what does not, and where could the list be incomplete?"
                minLength={8}
                maxLength={500}
                required
                readOnly={editingLocked}
              />
            </label>

            {selectedDraft?.latestReview ? (
              <div className={`draft-review-outcome is-${selectedDraft.reviewStatus}`}>
                <strong>
                  {selectedDraft.reviewStatus === "changes-requested"
                    ? "Changes requested"
                    : selectedDraft.reviewStatus === "scope-approved"
                      ? "Scope approved"
                      : selectedDraft.reviewStatus === "rejected"
                        ? "Draft rejected"
                        : "Previous review"}
                </strong>
                <p>{selectedDraft.latestReview.note}</p>
              </div>
            ) : null}

            {editingLocked ? (
              <div className="draft-locked-actions">
                <span aria-hidden="true">✓</span>
                <strong>
                  {selectedDraft?.reviewStatus === "scope-approved"
                    ? "Scope approved · answer bank still required"
                    : selectedDraft?.reviewStatus === "rejected"
                      ? "Review complete · draft rejected"
                      : "Submitted for review · editing locked"}
                </strong>
                <button type="button" onClick={startNewDraft}>Start another draft</button>
              </div>
            ) : (
              <div className="draft-form-actions">
                <button
                  className="draft-save-action"
                  type="submit"
                  disabled={operation !== "idle" || !isDirty}
                >
                  {operation === "saving"
                    ? "Saving…"
                    : selectedDraft
                      ? "Save changes"
                      : "Save private draft"}
                </button>
                <button
                  className="composer-primary-action"
                  type="button"
                  disabled={operation !== "idle"}
                  onClick={() => void handleSubmitForReview()}
                >
                  {operation === "submitting" ? "Submitting…" : "Submit for review"}
                </button>
              </div>
            )}

            {message ? (
              <p className={`draft-status is-${messageTone}`} role="status">{message}</p>
            ) : null}
          </form>
        </section>

        <aside className="draft-review-boundary">
          <h2>Review boundary</h2>
          <p>
            Submitting locks this draft for editing and sends it to the review queue.
          </p>
          <p>
            It does not create an answer bank, publish anything publicly, or grant ranked eligibility.
          </p>
          <ul>
            <li><span aria-hidden="true">✓</span> Prompt and scope recorded</li>
            <li><span aria-hidden="true">✓</span> Source documented</li>
            <li><span aria-hidden="true">✓</span> Coverage boundaries explicit</li>
            <li><span aria-hidden="true">✓</span> Answer bank still required</li>
          </ul>
        </aside>
      </div>
    </section>
  );
}
