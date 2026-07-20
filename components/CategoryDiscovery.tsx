"use client";

import Link from "next/link";
import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { parseApiResponse } from "@/lib/daily-contract";
import { parseCategoryDiscoveryPayload } from "@/lib/category-discovery-contract";
import type {
  CategoryDiscoveryEntry,
  CategoryDiscoveryPayload,
} from "@/lib/category-discovery-types";

const defaultPrompt = "How many NBA players can you name?";
const debounceMilliseconds = 180;

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 16.5-.8 3.3 3.3-.8L18.8 7.7l-2.5-2.5L5 16.5Z" />
      <path d="m14.9 6.6 2.5 2.5" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11m-4-4 4 4-4 4" />
    </svg>
  );
}

function categoryStatus(category: CategoryDiscoveryEntry): string {
  if (category.reviewStatus === "reviewed" && category.answerCount !== null) {
    return `${category.answerCount} reviewed answers`;
  }
  return "Practice bank in review";
}

function AmbientCards({ payload }: { payload: CategoryDiscoveryPayload }) {
  const cards: { label: string; value: string; note: string }[] = [];
  if (payload.ambient.todayBest) {
    cards.push({
      label: "Today’s best",
      value: `${payload.ambient.todayBest.score} names`,
      note: payload.ambient.todayBest.categoryTitle,
    });
  }
  if (payload.ambient.popularCategory) {
    cards.push({
      label: "Popular reviewed prompt",
      value: payload.ambient.popularCategory.categoryTitle,
      note: `${payload.ambient.popularCategory.verifiedRoundCount} verified rounds`,
    });
  }
  if (payload.ambient.liveRooms) {
    const roomCount = payload.ambient.liveRooms.roomCount;
    cards.push({
      label: "Live private rooms",
      value: `${roomCount} ${roomCount === 1 ? "room" : "rooms"}`,
      note: "Waiting or in play",
    });
  }
  return (
    <div className="ambient-card-layer" aria-label="Live NameMore activity">
      {cards.slice(0, 3).map((card, index) => (
        <article className={`ambient-card ambient-card-${index + 1}`} key={card.label}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <small>{card.note}</small>
        </article>
      ))}
    </div>
  );
}

export function CategoryDiscovery({
  initialPayload = null,
}: {
  initialPayload?: CategoryDiscoveryPayload | null;
}) {
  const [query, setQuery] = useState(defaultPrompt);
  const [payload, setPayload] = useState<CategoryDiscoveryPayload | null>(initialPayload);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(
    initialPayload?.categories[0]?.slug ?? null,
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(initialPayload === null);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const skipInitialRequest = useRef(initialPayload !== null);
  const listboxId = useId();

  const loadCategories = useCallback(async (nextQuery: string) => {
    const sequence = ++requestSequence.current;
    setIsLoading(true);
    try {
      const searchQuery = nextQuery === defaultPrompt ? "" : nextQuery;
      const response = await fetch(`/api/categories/discover?q=${encodeURIComponent(searchQuery)}`, {
        cache: "no-store",
      });
      const parsed = parseApiResponse(await response.json(), parseCategoryDiscoveryPayload);
      if (!parsed.ok) throw new Error(parsed.error.message);
      if (sequence !== requestSequence.current) return;
      setPayload(parsed.data);
      setError(null);
      setActiveIndex(0);
      setSelectedSlug((current) => {
        if (current && parsed.data.categories.some((category) => category.slug === current)) return current;
        return parsed.data.categories[0]?.slug ?? null;
      });
    } catch {
      if (sequence !== requestSequence.current) return;
      setError("The reviewed catalog is temporarily unavailable.");
    } finally {
      if (sequence === requestSequence.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (skipInitialRequest.current && query === defaultPrompt) {
      skipInitialRequest.current = false;
      return;
    }
    const timeout = window.setTimeout(() => void loadCategories(query), debounceMilliseconds);
    return () => window.clearTimeout(timeout);
  }, [loadCategories, query]);

  const categories = payload?.categories ?? [];
  const selected = categories.find((category) => category.slug === selectedSlug) ?? categories[0] ?? null;

  function selectCategory(category: CategoryDiscoveryEntry) {
    setSelectedSlug(category.slug);
    setQuery(category.prompt);
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setQuery(event.target.value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (categories.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const next = (activeIndex + direction + categories.length) % categories.length;
      setActiveIndex(next);
      setSelectedSlug(categories[next]?.slug ?? null);
    } else if (event.key === "Enter") {
      const category = categories[activeIndex];
      if (category) {
        event.preventDefault();
        selectCategory(category);
      }
    }
  }

  return (
    <section className="discovery-frame">
      <header className="discovery-header">
        <Link className="brand" href="/" aria-label="NameMore home">NameMore</Link>
        <nav aria-label="Primary navigation">
          <Link href="/daily">Daily</Link>
          <Link href="/room">Private rooms</Link>
        </nav>
      </header>

      {payload ? <AmbientCards payload={payload} /> : null}

      <div className="composer-stage">
        <div className="prompt-field-wrap">
          <label className="sr-only" htmlFor="category-prompt">Choose a category prompt</label>
          <textarea
            id="category-prompt"
            className="prompt-composer"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded="true"
            aria-activedescendant={categories[activeIndex] ? `${listboxId}-${categories[activeIndex].slug}` : undefined}
            autoComplete="off"
            spellCheck="false"
            rows={2}
          />
          <span className="prompt-edit-icon"><EditIcon /></span>
        </div>
        <p className="composer-guidance">Type a category or choose a reviewed prompt.</p>

        <div className="recommendation-rail" id={listboxId} role="listbox" aria-label="Category recommendations">
          {isLoading && categories.length === 0 ? (
            <p className="recommendation-message" role="status">Opening the reviewed catalog…</p>
          ) : null}
          {error ? (
            <p className="recommendation-message is-error" role="alert">
              {error} <Link href="/daily">Play today’s challenge.</Link>
            </p>
          ) : null}
          {!isLoading && !error && categories.length === 0 ? (
            <p className="recommendation-message">No reviewed prompt matches yet. Start a practice draft below.</p>
          ) : null}
          {categories.map((category, index) => {
            const isSelected = category.slug === selected?.slug;
            return (
              <button
                id={`${listboxId}-${category.slug}`}
                className={`recommendation-row${isSelected ? " is-selected" : ""}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                key={category.slug}
                onMouseEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                onClick={() => selectCategory(category)}
              >
                <span className="category-glyph" aria-hidden="true">{index + 1}</span>
                <span className="recommendation-copy">
                  <strong>{category.title}</strong>
                  <small>{categoryStatus(category)}</small>
                </span>
                <span className="recommendation-arrow"><ArrowIcon /></span>
              </button>
            );
          })}
        </div>

        {selected ? (
          <div className="composer-actions">
            <p className="category-trust-line">
              {selected.reviewStatus === "reviewed"
                ? `Reviewed · version ${selected.version}`
                : "Curated prompt · answer bank in review"}
            </p>
            {selected.availability === "daily" ? (
              <Link className="composer-primary-action" href="/daily">Play reviewed category <ArrowIcon /></Link>
            ) : selected.availability === "practice" ? (
              <Link className="composer-primary-action" href={`/practice/${selected.slug}`}>Play local practice <ArrowIcon /></Link>
            ) : (
              <button className="composer-primary-action" type="button" disabled>Practice bank in review</button>
            )}
          </div>
        ) : null}

        <Link
          className="draft-link"
          href={`/category/new?prompt=${encodeURIComponent(query)}`}
        >
          Create a practice draft
        </Link>
      </div>
    </section>
  );
}
