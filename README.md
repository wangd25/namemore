# NameMore

NameMore is a fast-paced, category-first recall platform where players try to name as many valid answers as possible before a timer expires. NBA players are the current manually curated proof of concept, not the permanent identity of the product. The planned first release is a secure single-player daily challenge; editable category discovery, private multiplayer, and elimination modes come later.

## Current Status

Phases 1–3 are complete. **Phase 3: Daily Leaderboard and Preview Release** passed its implementation, non-production Supabase, hostile-client, advisor, build, bundle, GitHub publication, protected Preview, desktop/mobile browser, and runtime-log gates.

**Current branch:** `codex/daily-ready-spring-latency`, created from the completed Phase 3 preview branch for a focused daily-availability, ready-motion, and answer-latency polish pass. `main` has not been changed or merged.

The focused post–Phase 3 polish verifies that the non-production database has an active current-UTC challenge and a continuous schedule through 2026-12-31. A single transient empty status now triggers one automatic recovery check before the safe unavailable state appears. The ready dwell uses a damped charge and squash-and-stretch launch instead of a linear loading treatment, and competitive automatic answer checks begin after a 180ms pause instead of 420ms with a small in-board pending cue. No answer data or scoring authority moved into the browser.

Vercel CLI authentication is established as `wangd25`. GitHub repository `wangd25/namemore` is connected to Vercel project `namemore` (`prj_w1Py6yIeo5YUcGGpduA32VdgFeSH`) in team `namemore`, and `main` is the configured production branch. Preview deployment `dpl_678tmSyH761zXoqfTnfdqsRg9hLh` at `https://namemore-5t10gmiq8-namemore.vercel.app` was verified `Ready` with `target: preview`, returned HTTP 200 with the expected page, and passed the deployed smoke check. Production has zero deployments.

Phase 2 application preview `dpl_uriC84X7XFDHzAZE5Wqhhzm9Xc6f` at `https://namemore-io5cx2wo8-namemore.vercel.app` was verified `Ready`, `target: preview`, and sourced from the Phase 2 branch/application commit. The protected deployed flow passed start, accepted, duplicate, refresh/resume, finish, desktop/mobile layout, console, and error-log checks. Vercel Production still has zero deployments.

Phase 3 application commit `a169bc12ccf4e6eb386d9ff3c53181ca22b39b54` (`Build trusted daily leaderboard`) is pushed to `origin/codex/phase-3-daily-leaderboard-preview`. Git-integrated Preview `dpl_76HfnTfCiJzhXciMskCWkwzHi7ck` at `https://namemore-crpu1byy8-namemore.vercel.app` was verified `READY`, `target: preview`, and sourced from that exact commit. Its protected desktop/mobile flow passed name, start, accepted, duplicate, refresh/resume, finish, leaderboard/tie, console, overflow, and HTTP/runtime-log checks. Production still has zero deployments and no environment variables.

Focused polish application commit `49d1687c65e05a3d060983b39693363490ef134a` (`Polish daily readiness and answer latency`) is pushed to `origin/codex/daily-ready-spring-latency`. Protected Preview `dpl_AAN9cqyDdoSspYU1NYqikypwTEiD` at `https://namemore-kivmej10g-namemore.vercel.app` was verified `READY` from that exact commit. Its real daily flow loaded the active 2026-07-20 UTC challenge, started through the hover dwell, accepted and scored two names, finished with a verified leaderboard result, showed the pending answer cue at the 181ms debounce boundary, and had no browser warnings, horizontal overflow, runtime errors, or non-2xx application responses at 1440×1000 and 390×844. Production and `main` remain untouched.

Supabase project `namemore` (`hutmxxlicxeaovoeqbwg`) was explicitly confirmed non-production. Anonymous sign-in is enabled. Six repository migrations now provide the private immutable category/alias bank, a UTC schedule through 2026-12-31, deny-all RLS tables, attempt/submission constraints and indexes, immutable display names, strict control-character rejection, a database answer-check burst guard, and five narrowly granted authenticated RPCs for status, named start, submit, finish, and top-ten leaderboard. Vercel contains only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, scoped to Preview; Production variables were not changed.

Implemented:

- Next.js 16 App Router with React 19, strict TypeScript, Tailwind CSS 4, ESLint, pnpm, and Vitest/React Testing Library configuration.
- A versioned `current-nba-players` category snapshot dated 2026-07-15.
- 30 NBA teams with 10 curated players per team, for 300 canonical answers total.
- Stable canonical answer IDs and selected manual aliases.
- Deterministic normalization for case, whitespace, punctuation, apostrophes, dashes, suffixes, and diacritics.
- Exact alias matching, unique-surname matching, and alias-collision protection.
- Shared domain types for categories and answer-submission results.
- A responsive true-white NameMore homepage using the Apple system font stack and one nearly full-viewport liquid-glass game board across ready, playing, ending, and finished states.
- A hover/focus/press-and-hold ready zone instead of a conventional Start button, with damped spring charging, squash-and-stretch launch feedback, and a reduced-motion-safe handoff while the verified round opens.
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
- Cookie-backed Supabase SSR sessions through Next.js 16 Proxy and request-scoped server clients; absent sessions fail closed or establish a Supabase anonymous identity.
- Thin no-store Route Handlers for daily status, start, answer submission, and finish, with bounded JSON input and generic error responses.
- Database-authoritative UTC challenge selection, one attempt per anonymous user/challenge, immutable start/deadline timestamps, hidden alias matching, atomic duplicate handling, accepted-answer presentation payloads, derived scores, expiration, and idempotent finish.
- A narrow daily Client Component preserving the Phase 1 ready/play/end/results presentation while treating server responses and the absolute server deadline as authoritative. Refresh resumes the original attempt and completed results remain viewable.
- An accessible display-name step before ready/start. Names normalize whitespace, allow 2–24 letters/numbers plus spaces, periods, apostrophes, and hyphens, are immutable after start, may be duplicated, and are never identity.
- A safe current-UTC top-ten result projection containing only deterministic rank, plain-text display name, verified score, and equal-score tie state. Completed/expired named attempts are eligible; active and legacy unnamed attempts are excluded.
- Deterministic leaderboard order: score descending, verified completion ascending, attempt creation ascending, then internal ID as an unexposed final fallback. Equal scores are marked tied even though the earlier verified result receives the earlier displayed position.
- A database-enforced per-attempt burst guard of 40 answer checks per 10 seconds. Database ownership, deadline, uniqueness, and derived-score constraints remain the final authority.
- One automatic recovery check for a transient empty daily-status response, plus a safe manual retry if the current UTC schedule remains unavailable.
- Competitive automatic checks begin after a 180ms typing pause and expose a small pending verification cue; the private answer bank and trusted match remain server-side.
- A deterministic 300-answer/561-alias seed plus 168 scheduled UTC challenge dates from 2026-07-17 through 2026-12-31.
- Sixty-nine passing unit, dataset, contract, session, request-boundary, migration, and component tests across eleven test files, plus a direct publishable-key hostile-client script.

Not implemented yet:

- Private rooms, Realtime multiplayer, elimination mode, global aggregates, or production launch hardening.
- CAPTCHA. A broader unprotected preview requires a product choice and credentials for hCaptcha or Cloudflare Turnstile; the current preview remains protected by Vercel team authentication.
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

Verification snapshot from 2026-07-18 UTC:

- `git diff --check`, `pnpm lint`, `pnpm typecheck`, and the Next.js production build pass.
- `pnpm test` passes 66 tests in 11 test files.
- The hostile-client script passes directly against Supabase using only the public URL/publishable key and anonymous identities. It additionally proves display-name validation/normalization/immutability, active-attempt exclusion, top-ten limiting, deterministic tie order, safe projection keys, no UUID/answer leakage, direct leaderboard insertion denial, concurrent idempotent finish, and the 40-per-10-second burst guard.
- A rollback-only live database deadline test returned `round-ended` and `expired` without accepting a late answer. Migration history, 300 answers, 561 aliases, 168 scheduled challenges through 2026-12-31, RLS, grants, constraints, and indexes were inspected live.
- Supabase security advisors report only intentional deny-all/no-policy tables, the five intentionally callable authenticated security-definer RPCs, and leaked-password protection for the deferred permanent-account path. Performance advisors report only expected unused indexes on the fresh schema; both missing foreign-key indexes were fixed.
- `pnpm audit:client-bundle` audits the page’s manifest-referenced browser chunks and finds no NBA answer-bank markers. HTML inspection also found no canonical answer leakage before acceptance.
- Local and protected deployed browser QA at 1440×1000 and 390×844 completed the real Next.js/Supabase flow: malicious-name rejection, normalized name, named start, accepted answer, duplicate without score change, refresh/resume at the original deadline, finish, leaderboard, forced local offline/error and retry recovery, deterministic ties, HTTP 200/204 route responses, no application or runtime errors, no answer-bank leakage, and no horizontal overflow.

## Roadmap Remaining

Phases 1–3 are complete. **5 later product phases remain**: private-room lobby, live private-race multiplayer, elimination mode, general category studio/discovery, and production hardening/launch.

In Codex desktop, the shell may not include `node` on its default `PATH`. Use the bundled workspace Node runtime when that occurs; do not treat a missing shell executable as an application failure.

## Current Project Structure

```text
app/
  api/daily/             No-store status/named-start/submit/finish/leaderboard Route Handlers
  globals.css            White liquid-glass, clean answer-surface, ripple, and responsive rules
  layout.tsx             Root layout and NameMore metadata
  page.tsx               Server-rendered NameMore homepage shell
components/
  DailyGameBoard.tsx     Narrow server-authoritative timer/input Client Component
  DailyGameResults.tsx   Verified accepted-answer timeline and team coverage
  DailyLeaderboard.tsx   Safe top-ten loading/empty/error/tie projection
  GameBoard.tsx          Ready dwell, clean answer field, delight feedback, timer, and local state
  GameResults.tsx        Detailed local timeline, metrics, coverage, sharing, and replay UI
lib/
  categories.ts          Versioned 300-player NBA dataset
  category-types.ts      Category and submission domain types
  daily-*.ts             Safe contracts, browser API, Route helpers, and trusted RPC service
  supabase/              SSR config, request client, anonymous session, and Proxy refresh
  game-logic.ts          Matching and canonical submission evaluation
  normalize.ts           Deterministic answer normalization helpers
  practice-game.ts       Local result metrics, storage, team coverage, and share helpers
scripts/
  audit-client-bundle.mjs      Manifest-scoped answer-bank leak audit
  hostile-client-check.mjs     Direct public-key Supabase authorization/concurrency checks
supabase/
  config.toml             Anonymous-auth local configuration
  migrations/             Schema/seed, schedule, RPC correction, and index migrations
AGENTS.md                 Repository-wide product, security, and coding rules
plan.md                   Eight-phase implementation plan and live status
```

There is no multiplayer route, Realtime feature, permanent account, aggregate community analytics, CAPTCHA integration, or production deployment.

## Security Boundary

The daily answer bank is private database data and is absent from competitive browser JavaScript, HTML, RSC payloads, and public API responses. Anonymous users receive the `authenticated` role, but direct table access remains denied by explicit grants and RLS; only five narrow RPCs are executable. The leaderboard RPC exposes no UUIDs, answers, guesses, auth metadata, attempt IDs, or ordering timestamps. Browser-visible configuration contains only the Supabase project URL and publishable key. Never introduce a service-role key into this application path or weaken the deny-by-default boundary.

The future multiplayer visual direction uses equal player and opponent liquid-glass boards. Opponent typing will look live through synthetic blurred placeholders based only on safe typing status and a coarse length bucket. Raw opponent letters or answers must never be sent to the browser during an active round.
