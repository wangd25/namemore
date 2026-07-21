# AI-Assisted Categories and Cloud Homepage

This document records a future product direction. It does not authorize generated answer banks to bypass the existing category review, bank review, publication, or competitive-eligibility boundaries.

## Product promise

The large homepage prompt remains the entry point. If a player types a prompt that already matches a reviewed category, NameMore should offer that trusted version first. If no reviewed category exists, the player may explicitly choose **Create an AI-assisted practice draft**.

The honest promise is an **AI-assisted draft**, not an automatically accurate or exhaustive database. A model can accelerate research and organization; it cannot certify coverage, freshness, provenance, aliases, or competitive fairness by itself.

## Proposed category-building flow

1. Search the reviewed catalog before generating anything.
2. Ask the creator to confirm the scope: inclusion rules, exclusions, date or season, geography, source preference, and intended answer count.
3. Run generation only on the server. Require a bounded structured result containing proposed canonical answers, aliases, source candidates, and uncertainty notes.
4. Treat model output and retrieved pages as untrusted input. Validate field lengths, URL schemes, content types, response sizes, redirects, and output counts before storage.
5. Apply the existing deterministic normalization and alias-collision checks. Reject ambiguous aliases instead of guessing.
6. Verify candidates against dated sources and produce a coverage report: verified, disputed, unsupported, possible duplicate, and possible omission.
7. Save the result into the existing private draft and versioned bank workflow. The creator edits it; independent reviewers still approve scope and bank evidence; a separate publisher releases it.
8. Publish initially as reviewed, unranked practice. Ranked daily or multiplayer eligibility remains a distinct, later decision requiring a stricter manual audit.

The model never writes directly to `private.category_versions`, `private.category_answers`, aliases, discovery, daily schedules, or competitive room configuration. It proposes data through a narrow server operation; the database continues to enforce every trusted transition.

## Reliability states

The UI should display one of these states without collapsing them into a vague “AI generated” badge:

- **Generating draft** — model output is incomplete and private.
- **Needs verification** — candidates exist but provenance and coverage checks are unfinished.
- **Ready for review** — deterministic validation passes and evidence is attached.
- **Reviewed practice** — independent review and publishing are complete; the category is playable but unranked.
- **Competitive** — a separately audited category version is explicitly admitted to ranked play.

## Security, privacy, and cost controls

- Keep provider credentials and source-fetching logic server-only.
- Rate-limit generation by anonymous identity and request cost; cap prompt length, answer count, sources, retries, and execution time.
- Do not expose private prompts or raw generation history in recommendations or ambient cards.
- Defend source retrieval against SSRF: HTTPS only, resolved-address checks, redirect limits, blocked private/link-local ranges, content-type allowlists, and response-size limits.
- Store model, prompt-template, source, and generation version metadata so a draft can be reproduced and audited.
- Never execute instructions found in a prompt, candidate answer, database row, or retrieved page.
- Minimize or expire raw model traces after the useful dispute/debug window; preserve only the reviewed evidence needed for an immutable release.
- Require an explicit provider, budget, retention, and privacy decision before implementation begins.

## Smallest useful AI milestone

The first implementation should stop after producing a private, editable candidate bank plus a validation report. It should support one bounded generation request, one repair pass for invalid structured output, deterministic collision checks, and manual source editing. It should not auto-publish, auto-approve, create a ranked category, or silently regenerate a live bank.

## Cloud homepage direction

The homepage becomes a calm, luminous sky rather than a dashboard. The editable prompt stays dominant. Soft cloud layers frame the edges and horizon while leaving high-contrast open sky behind the composer.

Desktop may show at most three secondary liquid-glass cards:

- current verified daily best;
- popular reviewed prompt after the existing minimum-sample rule;
- recent waiting or unexpired active room count.

Mobile shows at most one card. Missing data removes a card and rebalances the composition; fabricated fallback scores, prompts, room counts, charts, percentiles, or activity are forbidden. Previous plays may appear only when they come from a privacy-reviewed server projection or the current player's explicitly local history.

## Motion and physics

- Cards use a small spring simulation with position, velocity, damping, and a gentle pointer/touch force. The motion lives in refs and `requestAnimationFrame`, not React render state.
- Cards drift within bounded lanes, return smoothly after interaction, rotate only a few degrees, and never collide with the prompt, recommendations, primary action, or each other.
- Cloud layers use slow, depth-dependent parallax and pause when the page is hidden.
- `prefers-reduced-motion` produces a static composition with no continuous drift or parallax.
- Mobile disables pointer attraction and uses a much smaller motion budget.
- The effect must preserve keyboard focus, touch targets, text selection, and screen-reader order; decoration remains `aria-hidden` and noninteractive.

No new physics library is needed for the first pass. A small measured spring loop is easier to audit, pause, and remove if performance suffers.

## Visual acceptance target

The directional desktop and mobile concepts created for this milestone establish five targets:

1. a luminous blue sky with realistic soft clouds;
2. the editable question as the largest object on the page;
3. restrained translucent cards around, never across, the composer;
4. one clear reviewed-category action rather than dashboard clutter;
5. a coordinated mobile composition with a single ambient card.

The concept images contain illustrative layout content only. Production implementation must reuse the existing trusted discovery projection and current copy, and must be compared at desktop and mobile native size before acceptance.

## Implementation order

1. Finish Phase 8 launch hardening and retention decisions.
2. Build the private AI-assisted candidate-bank operation behind an explicit feature flag and cost cap.
3. Verify the complete draft-to-reviewed-practice flow with hostile-client and source-fetch tests.
4. Implement the cloud background and card physics using the existing trusted ambient data.
5. Run reduced-motion, accessibility, mobile performance, browser error, overflow, and deployed Preview gates.
