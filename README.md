# NameMore

NameMore is a fast-paced, category-first recall platform where players try to name as many valid answers as possible before a timer expires. NBA players are the current manually curated proof of concept, not the permanent identity of the product. The planned first release is a secure single-player daily challenge; editable category discovery, private multiplayer, and elimination modes come later.

## Current Status

The project has a **locally complete Phase 1 of 8: Playable Single-Player Vertical Slice**. Its reviewed branch, focused application commit, GitHub push, and cleanup of the unintended Vercel production deployment are complete. The preview-only deployment and deployed smoke-test portion of the publication gate is blocked on Vercel CLI authentication and remains incomplete.

**Handoff state:** `codex/phase-1-whiteboard-preview` contains pushed commit `09fcb0d3b412bbb9d289dfc3a579f4fe3325a696` (`Build Phase 1 whiteboard recall game`). The commit contains the 34 reviewed Phase 1 application, test, configuration, asset, lockfile, and documentation paths; the local and remote branch heads matched after push. `main` was not changed or merged, and no Supabase or Phase 2 work was performed.

The pushed branch did not produce a Git-integrated Vercel check, and the accessible Vercel team initially had no project. A Vercel connector call explicitly requesting a preview instead created project `prj_911Yucv5Ugu7vGeLqkWunrjswBSV` and deployment `dpl_3jzQLEEoH6jFyU3ikSbXYYhYYwPZ` as a production target. The exact isolated project and its only deployment were deleted through the authenticated Vercel dashboard on 2026-07-17; authoritative reads now return `404` for both IDs and the team project inventory is empty. Two subsequent Vercel CLI device-login attempts were rejected while the CLI remained waiting, so no replacement project or deployment was created. Publication remains blocked until an authenticated preview-only deployment of the pushed commit is available and smoke-tested.

Implemented:

- Next.js 16 App Router with React 19, strict TypeScript, Tailwind CSS 4, ESLint, pnpm, and Vitest/React Testing Library configuration.
- A versioned `current-nba-players` category snapshot dated 2026-07-15.
- 30 NBA teams with 10 curated players per team, for 300 canonical answers total.
- Stable canonical answer IDs and selected manual aliases.
- Deterministic normalization for case, whitespace, punctuation, apostrophes, dashes, suffixes, and diacritics.
- Exact alias matching, unique-surname matching, and alias-collision protection.
- Shared domain types for categories and answer-submission results.
- A responsive true-white NameMore homepage using the Apple system font stack and one nearly full-viewport liquid-glass game board across ready, playing, ending, and finished states.
- A hover/focus/press-and-hold ready zone instead of a conventional Start button.
- A clean translucent whiteboard with borderless in-board typing, automatically accepted exact names, explicit aliases, and unique last names, plus a compact score without a visible Submit button. Prefix-conflicting matches pause briefly so longer names can be completed.
- Pointer-following liquid-droplet ripples on the ready zone and writing board, with keyboard, touch, and reduced-motion-safe behavior preserved.
- A near-edge-to-edge game shell and unruled writing surface with compact answer typography. The mouse treatment is a small 46px desktop/36px mobile liquid lens that follows the pointer without looping or appearing from keyboard focus alone.
- A restrained 90ms ink-focus response while typing, a springing green check, a clearer accepted player's team-color wash, a reusable topic-icon slot beside each answer, and wet-ink settle when a valid player lands.
- Quick consecutive answers trigger a board-wide green liquid ripple and a temporary liquid-glass notification with the measured answer gap and natural reactive copy.
- Fast wet-ink settling for accepted answers, a restrained board-wide wave every five names, and duplicate feedback that briefly locates the original accepted line.
- A 90-second absolute-deadline timer, final-ten-second visual tension, graceful ending freeze, keyboard fallback submission, feedback, manual finish, and replay.
- Optional failure-safe Web Audio and supported-device haptics for accepted, duplicate, milestone, and round-ended feedback. Accepted answers now use a slightly louder two-note glass chime, with an accessible versioned local preference.
- A versioned, corruption-safe local-practice best that is clearly labeled unranked and never treated as competitive truth.
- Detailed local results with score, local best, answers per minute, acceptance timeline, fastest gap, longest pause, duplicate count, and represented/missed NBA teams.
- Explicitly activated spoiler-safe sharing through Web Share when available, with a clipboard fallback that does not include accepted or missed player names.
- Accessible form labels, focus states, an ARIA live region, and reduced-motion behavior.
- Thirty-eight passing unit, dataset, component, and local-practice tests across five test files.

Not implemented yet:

- Authenticated creation of a commit-addressable preview-only deployment of the pushed Phase 1 commit and the deployed desktop/mobile smoke test.
- Daily challenge routes, server-authoritative validation, anonymous identity, Supabase schema/RLS, and leaderboard.
- Private rooms, Realtime multiplayer, elimination mode, rate limiting, and production launch hardening.
- The editable prompt composer, community-derived recommendations, general custom-category workflow, ambient popular-prompt/high-score/lobby cards, and category-agnostic result metrics.

## Product Direction Beyond NBA

The ready-state question is intended to become the product's main category composer. A player will be able to edit the large prompt, search reviewed categories, and receive keyboard-accessible suggestions based on moderated aggregate usage. Selecting a trusted existing category should start quickly; entering a new idea should open a separate category-creation flow rather than silently pretending that an exhaustive answer bank already exists.

The surrounding ready screen may carry a sparse atmospheric layer of slowly drifting liquid-glass cards: popular prompts, verified high scores, active public lobbies, or tiny aggregate trend traces. They should fade gently, remain secondary to the prompt, disappear under reduced-motion or constrained mobile conditions, and never turn the homepage into a dense dashboard. Until real server-authoritative aggregates exist, the product must not fabricate community activity, scores, or charts.

Universal category and answer contracts will eventually treat icons, colors, teams, eras, franchises, artists, flags, or other marks as optional category-provided metadata. The existing NBA team slot is the first renderer for that general visual area.

Generated or community-supplied answer banks require provenance, deterministic normalization and collision checks, versioning, moderation, and explicit coverage/review status. Unreviewed categories remain practice-only and must not enter ranked daily play or competitive multiplayer.

See [`plan.md`](./plan.md) for the phase-by-phase roadmap and current progress.

## Local Development

Requirements:

- Node.js 20 or newer
- pnpm 11

Install dependencies and start the development server:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Available checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Verification snapshot from 2026-07-17:

- The 34-path publication scope was re-audited on `codex/phase-1-whiteboard-preview`. `git diff --check` passes; no `.env` files, credential-like assignments, token-shaped values, trailing-whitespace text files, generated output, API, Supabase, or migration directories were found.
- `pnpm lint` passes.
- `pnpm typecheck` passes.
- `pnpm build` passes and statically generates `/`.
- `pnpm test` passes 38 tests in 5 test files.
- Browser QA verified the ready, playing, and results states at 1440×1000 and 390×844 with no application console warnings/errors or horizontal overflow. The latest production-build trial confirmed a fully transparent, borderless typing line; automatic `James` → `LeBron James` acceptance after the prefix-safe delay; topic icons immediately beside accepted names; stronger team-color washes; and a green quick-pair ripple with a timed glass notification. The mobile notification sits below the answer area without overlapping accepted names. The complete flow also covers fifth-answer milestones, canonical duplicate highlighting, graceful finish, results/timeline/team coverage, and replay. Web Share was available in the test browser, so its native share sheet was not opened automatically; automated tests verify the clipboard fallback and spoiler-free payload.

## Roadmap Remaining

Phase 1 has only its Vercel authentication, preview, and smoke-test gate left. After that gate is completed, **7 full phases remain**: server-authoritative daily play, leaderboard/preview release, private-room lobby, live private-race multiplayer, elimination mode, general category studio/discovery, and production hardening/launch.

In Codex desktop, the shell may not include `node` on its default `PATH`. Use the bundled workspace Node runtime when that occurs; do not treat a missing shell executable as an application failure.

## Current Project Structure

```text
app/
  globals.css            White liquid-glass, clean answer-surface, ripple, and responsive rules
  layout.tsx             Root layout and NameMore metadata
  page.tsx               Server-rendered NameMore homepage shell
components/
  GameBoard.tsx          Ready dwell, clean answer field, delight feedback, timer, and local state
  GameBoard.test.tsx     Component interaction, timer, preference, and replay tests
  GameResults.tsx        Detailed local timeline, metrics, coverage, sharing, and replay UI
lib/
  categories.ts          Versioned 300-player NBA dataset
  categories.test.ts     Dataset invariant tests
  category-types.ts      Category and submission domain types
  game-logic.ts          Matching and canonical submission evaluation
  game-logic.test.ts     Matching, collision, and duplicate tests
  normalize.ts           Deterministic answer normalization helpers
  normalize.test.ts      Normalization and name-helper tests
  practice-game.ts       Local result metrics, storage, team coverage, and share helpers
  practice-game.test.ts  Local metrics, storage corruption, and spoiler-safe share tests
AGENTS.md                 Repository-wide product, security, and coding rules
plan.md                   Eight-phase implementation plan and live status
```

There are currently no API Route Handlers, `supabase/` migrations, authentication flows, leaderboards, or multiplayer routes.

## Security Boundary

Phase 1 is intentionally local and noncompetitive, so its answer bank may eventually be included in the browser bundle. Before scores become persistent, Phase 2 must move answer validation, timing, ownership, and scoring to trusted server/database code. Never place server-only credentials in browser code or weaken Supabase RLS to make a feature work.

The future multiplayer visual direction uses equal player and opponent liquid-glass boards. Opponent typing will look live through synthetic blurred placeholders based only on safe typing status and a coarse length bucket. Raw opponent letters or answers must never be sent to the browser during an active round.
