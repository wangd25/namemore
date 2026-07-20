# NameMore Implementation Plan

## Current Findings

- Phase 6 is complete on `codex/phase-6-atomic-elimination`. One forward-only migration adds the deny-all claim table, unique `(room_id, answer_id)` first-owner invariant, mode-aware room creation, and atomic answer submission while preserving the one-argument private-race creator. Application commit `1781efe1ca641d26f2607103b1b833d5ceb5d8ab` is pushed; exact-source protected Preview `dpl_GDCbaEUg19nSxAGdKBPKzkPfg6HU` is `READY` and passed protected homepage/room/current-daily smoke, runtime error/5xx, two-browser simultaneous-claim, answer secrecy, ownership reveal, and desktop/mobile visual gates.
- Phase 5 is complete on `codex/phase-5-live-private-race`. Three forward-only migrations add deny-all per-player submissions, canonical per-player uniqueness, answer-check burst control, server-authoritative game/submit/reveal RPCs, a corrective foreign-key index, and private per-player Realtime authorization. Application commit `cba8380e8b93d65383b9c0342aa6fc172b5e73c3` is pushed; exact-source protected Preview `dpl_ADAE2bevosLdTLLMof3LKp478QvE` is `READY` and passed protected smoke/error-log checks. Separate in-app and Chrome sessions completed the same private race with synchronized safe counts, hidden active answers, and server-deadline reveal.
- Phase 4 is complete on `codex/phase-4-secure-room-lobby`. Two forward-only migrations add deny-all room/player tables, indexed host linkage, non-ambiguous codes, unique membership, atomic capacity and host-only start enforcement, plus four narrow authenticated RPCs. Application commit `84731004b12b151c22eff3b1e34a31ddbf3db3e8` is pushed; exact-source protected Preview `dpl_9NjNPMpW3bshp43RPdQYWA6FRDCr` passed the two-session desktop/mobile create, join, refresh, synchronize, start, console, overflow, HTTP, and runtime-log gates.
- As of 2026-07-18 UTC, Phase 2 is complete. It passed local/non-production Supabase, direct hostile-client, advisor, bundle-leak, GitHub publication, and local/deployed desktop/mobile browser gates.
- Phase 3 is complete on `codex/phase-3-daily-leaderboard-preview`. Its two reviewed migrations are applied to the confirmed non-production project, application commit `a169bc12ccf4e6eb386d9ff3c53181ca22b39b54` is pushed, and exact-source protected Preview `dpl_76HfnTfCiJzhXciMskCWkwzHi7ck` passed desktop/mobile flow, HTTP, console, overflow, runtime error/5xx, and Production-isolation gates.
- The focused post–Phase 3 branch `codex/daily-ready-spring-latency` hardens transient empty-status recovery, replaces the ready dwell's linear loading feel with damped spring charge/launch motion, and reduces competitive automatic-check debounce from 420ms to 180ms with an immediate pending cue. On 2026-07-20 UTC, the non-production database was independently verified to have one active challenge today and a continuous 168-day schedule through 2026-12-31; no schema or trusted-data change was needed. Application commit `49d1687c65e05a3d060983b39693363490ef134a` is pushed, and exact-source protected Preview `dpl_AAN9cqyDdoSspYU1NYqikypwTEiD` passed its desktop/mobile daily flow, answer-latency, console, overflow, and runtime-log gates.
- `codex/phase-2-server-authoritative-daily` adds cookie-backed Supabase anonymous sessions, Next.js 16 Proxy/session refresh, four thin daily Route Handlers, runtime-validated safe contracts, and a narrow daily game Client Component that never imports the answer bank.
- Non-production Supabase project `namemore` (`hutmxxlicxeaovoeqbwg`) has anonymous sign-in enabled and twelve applied repository-owned migrations. The Phase 6 migration adds the deny-all atomic claim model and mode-aware RPC overload.
- The database contains 300 canonical answers and 561 normalized aliases in the unexposed `private` schema. All ten application tables have RLS enabled and no permissive direct browser policies. Direct table privileges are revoked; twelve gameplay/status RPC signatures plus one Realtime authorization helper enforce `auth.uid()`, membership, ownership, deadlines, atomic uniqueness/capacity/claims, immutable names, host authority, derived scores, active-answer secrecy, and safe projection.
- Vercel project `namemore` contains only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, scoped to Preview. No Production variables or deployments were changed.
- `pnpm test` passes 94 tests across 16 files. `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm audit:client-bundle`, and `git diff --check` pass. All four public-key hostile scripts pass with Preview-scoped public configuration. Local browser QA covers desktop/mobile entry/active/results rendering and a true two-browser create/join/start/simultaneous-claim/synchronize/reveal flow; the protected Preview passed authenticated CLI smoke and runtime-error/5xx scans.
- As of 2026-07-17, the Phase 1 implementation and local checks are complete. The 34-path publication scope was re-audited successfully, committed as `09fcb0d3b412bbb9d289dfc3a579f4fe3325a696` on `codex/phase-1-whiteboard-preview`, and pushed to `origin`.
- The homepage renders the responsive NameMore local practice game with `ready`, `playing`, `ending`, and `finished` states, an absolute-deadline timer, hover/focus/press-and-hold readiness, continuous typing with automatic exact/alias acceptance, keyboard fallback submission, feedback, scoring, accepted answers, manual finish, and replay.
- NameMore's target product is category-first. NBA players are the current manually curated vertical slice; the future ready-state headline becomes an editable prompt composer with reviewed-category recommendations and a distinct custom-category creation path. This direction is documented but not implemented or authorized before the Phase 1 publication gate.
- The future ready screen may include a sparse ambient layer of slowly drifting liquid-glass cards for real popular prompts, verified high scores, active public lobbies, or tiny aggregate trend traces. These cards remain secondary, reduced-motion-safe, mobile-aware, and absent when trusted aggregate data is unavailable; fabricated activity is prohibited.
- The interface uses the Apple system font stack on a true-white, prediction-market-inspired canvas. One nearly full-viewport translucent liquid-glass board contains a compact timer/score HUD and a clean unruled whiteboard with borderless in-board typing. Pointer-origin liquid ripples react on the ready and writing surfaces without per-movement React renders.
- The completed local delight pass adds wet-ink answer settling, a board-wide milestone wave every five answers, duplicate-line highlighting, optional failure-safe sound/haptics with a slightly louder two-note accepted-answer chime, a versioned local-practice best, final-ten-second tension, a graceful ending freeze, detailed local results, and explicitly activated spoiler-safe sharing.
- The current playing surface is near full-bleed, with a restrained transform-free 90ms typing response and a spring-check/stronger-team-color-wash acceptance treatment. Reusable answer icon slots sit directly beside names and currently render compact NBA team marks. Two answers within 2.5 seconds trigger a board-wide green liquid ripple and a temporary notification with measured timing and tiered natural copy. Local practice keeps its 420ms prefix-conflict wait; the server-authoritative daily begins secure automatic checks after a 180ms typing pause and shows a small pending cue while preserving the private answer bank. The pointer effect is a compact 46px desktop/36px mobile lens that follows mouse position without looping or appearing solely from keyboard focus.
- Local results calculate only available practice data: score, local best, answers per minute, acceptance timeline, shortest accepted-answer gap, longest pause, duplicate attempts, and represented/missed NBA teams. Global averages, percentiles, rarity, and other-user statistics remain deferred until trusted server data exists.
- `lib/categories.ts` contains a versioned 2026-07-15 NBA snapshot with 30 teams, 10 players per team, and 300 canonical answers.
- `lib/normalize.ts` and `lib/game-logic.ts` implement deterministic normalization, canonical lookup construction, explicit aliases, unique-surname aliases, and collision detection.
- Vitest and React Testing Library run 58 passing unit, dataset, component, contract, request-boundary, session, and migration tests across 10 test files.
- There is no permanent account, general aggregate analytics, CAPTCHA integration, or production deployment.
- `main` tracks the private GitHub repository `wangd25/namemore`.
- The approved branch preserved the complete dirty `main` state before staging. The focused Phase 1 commit contains the reviewed application, tests, configuration, assets, lockfile, and documentation; local and remote branch heads matched after push, and `main` was not changed or merged.
- The refreshed publication-readiness audit found no `.env` files, credential-like assignments, token-shaped values, trailing-whitespace text files, generated output, API, Supabase, or migration directories. `git diff --check` passes.
- Node is not on the shell's default `PATH`, but the Codex workspace provides Node 24 and pnpm 11 for scaffolding and verification.
- With the bundled Node runtime on `PATH`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass as of 2026-07-17.
- Vercel CLI authentication is established as `wangd25`. GitHub repository `wangd25/namemore` is connected to Vercel project `namemore` (`prj_w1Py6yIeo5YUcGGpduA32VdgFeSH`) in team `namemore`, with `main` configured as the production branch. Preview deployment `dpl_678tmSyH761zXoqfTnfdqsRg9hLh` at `https://namemore-5t10gmiq8-namemore.vercel.app` was verified `READY` with `target: preview`, returned HTTP 200 with the expected page, and passed the deployed smoke check. Production has zero deployments.
- Browser QA verified ready, playing, and result states at 1440×1000 and 390×844 with no application console warnings/errors or horizontal overflow. The latest production-build trial confirmed a transparent borderless writing line, prefix-safe `James` → `LeBron James` acceptance, topic-icon adjacency, the stronger team-color wash, and the green quick-pair ripple/notification. At 390×844 the notification sits below the answer area without covering accepted names. The complete flow also covers milestone, duplicate location, graceful finish, timeline/team coverage, and replay. Web Share was present in the test browser, so its native share sheet was not opened automatically; automated tests cover the clipboard fallback and spoiler-free payload.

## Progress Snapshot

| Phase | Status | What remains |
| --- | --- | --- |
| 1. Playable single-player vertical slice | **Complete** | All implementation, publication, preview-target verification, and deployed smoke-test gates passed. |
| 2. Server-authoritative daily challenge | **Complete** | Implementation, trusted-data, publication, preview-target, deployed flow, and logs gates passed. |
| 3. Daily leaderboard and preview release | **Complete** | All implementation, trusted-data, publication, preview-target, protected deployed-flow, and log gates passed. |
| 4. Secure private room lobby | **Complete** | All implementation, database, hostile-client, publication, protected Preview, two-session browser, and runtime-log gates passed. |
| 5. Live private-race multiplayer | **Complete** | Private submissions, safe Realtime, reconnect fallback, synchronized boards, and post-round reveal passed. |
| 6. Atomic elimination mode | **Complete** | Transactional first-owner claims, safe already-taken feedback, private-race regression, and concurrency gates passed. |
| 7. General category studio and discovery | **Not started** | Category-agnostic contracts, editable prompt recommendations, moderated custom-category drafts, and real aggregate discovery cards. |
| 8. Production hardening and launch | **Not started** | Abuse controls, retention, full reviews, release verification, and production smoke tests. |

**Phase count:** Phases 1–6 are complete, and 2 later product phases remain.

## Locked Product and Architecture Decisions

- Build with the latest patched stable Next.js 16 App Router, React 19.2.4 or newer, strict TypeScript, Tailwind CSS, pnpm, ESLint, and Vitest.
- Use Server Components by default. Keep timer/input behavior in a narrow Client Component and keep trusted scoring, timing, and ownership in server/database code once persistence begins.
- The first category is a versioned snapshot of **300 current NBA players: ten players per team**. It is manually curated from official NBA team rosters at implementation time; there is no runtime sports API.
- NBA-specific team codes, colors, logos, and coverage metrics are presentation metadata for this first category, not permanent requirements of the universal category or answer contract. The reusable topic-icon area must support optional category-provided visuals or text fallbacks for any subject.
- The ten-player selection represents each team's expected primary rotation. The dataset records its `snapshotDate` and version, and later roster changes create a new immutable version rather than rewriting a historical challenge.
- Each player has a stable internal ID, canonical full name, team code, and curated aliases. Full names are always accepted. Last-name-only aliases are accepted only when unique across the category. Ambiguous aliases are rejected during dataset validation.
- Normalization is deterministic: Unicode normalization, diacritic removal, lowercase conversion, apostrophe/dash normalization, non-alphanumeric punctuation removal, whitespace collapse, and trimming. There is no fuzzy matching.
- Use Supabase anonymous Auth for durable browser identity. Anonymous users receive the `authenticated` database role, so every policy must also enforce row ownership with `auth.uid()`; `TO authenticated` alone is never sufficient.
- Daily challenges reset globally at 00:00 UTC. A user gets one attempt record per challenge, may resume it until its original deadline, and may not restart it.
- Daily leaderboard order is score descending, verified completion time ascending, then attempt creation time ascending. Display names are not unique.
- Multiplayer defaults: 90-second rounds, maximum eight players, eight-character non-ambiguous room codes, no joining after start, no host transfer, and rejoin is allowed for the same anonymous user.
- The product visual system uses a true-white canvas, restrained prediction-market-like information hierarchy, crisp black/gray type, cobalt actions, and translucent liquid-glass game surfaces. Multiplayer uses two equal boards on desktop and a stacked layout on narrow screens.
- Current typography uses the Apple system font stack. The timer and score remain small and secondary; the clean answer surface is the dominant visual object.
- A large dwell zone replaces the conventional Start button. Hovering it starts desktop play after a short signal; keyboard focus/activation and touch press-and-hold provide equivalent access. A restrained liquid-droplet ripple follows pointer position across this zone and the writing board.
- In the general-category milestone, the large ready-state question becomes an editable accessible combobox. It recommends reviewed category versions using moderated, privacy-preserving aggregate usage. A new idea enters a separate drafting/review flow; typing arbitrary text must not silently create a supposedly exhaustive or ranked-eligible answer bank.
- The ready surface may later include a few low-contrast liquid-glass prompt, score, lobby, or trend cards. They must use real server-authoritative aggregates, avoid the prompt's reading and pointer path, stop or disappear for reduced motion, and collapse on constrained mobile screens.
- During play, exact names, explicit aliases, and unique surnames are resolved continuously. A match that prefixes another valid answer waits briefly before resolving; Enter still accepts it immediately. Accepted answers settle directly onto the whiteboard above the borderless typing line, the field clears, and the score increments without a visible Submit button.
- Stronger motion is reserved for meaningful local events: wet-ink acceptance, every-fifth-answer waves, duplicate location, and final-ten-second tension. The playing surface remains free of detailed analytics, popups, autocomplete, hints, bonus scoring, and dashboard density.
- Local storage is limited to versioned feedback preference and local-practice best keys. Corrupt or unavailable storage fails safely, and local bests are never trusted for ranked play.
- Generated and community-authored categories require provenance, answer-bank validation, deterministic alias-collision checks, immutable versions, moderation, and explicit practice/share/public/ranked eligibility. Unreviewed categories cannot enter daily leaderboards or competitive rooms.
- Live opponent typing is represented by synthetic blurred placeholders derived from typing status and a coarse length bucket. Raw letters and answer text are never sent to opponents during the active round; CSS blur is not a privacy boundary.
- Each phase is implemented in a separate chat after approval, preserves prior work, and ends with focused tests, full available checks, diff review, and a documented handoff. Publishing, database application, and deployment require explicit approval in that phase.

## Shared Interfaces and Security Rules

Core domain types will remain small and explicit:

```ts
type CategoryAnswer = {
  id: string;
  canonicalText: string;
  aliases: readonly string[];
  teamCode: string;
};

type Category = {
  slug: string;
  version: number;
  snapshotDate: string;
  title: string;
  prompt: string;
  timeLimitSeconds: number;
  answers: readonly CategoryAnswer[];
};

type AnswerSubmissionResult =
  | { status: "accepted"; answer: CategoryAnswer; score: number }
  | { status: "duplicate"; answer: CategoryAnswer }
  | { status: "invalid" }
  | { status: "round-ended" };
```

This remains the Phase 1 local-practice union. The multiplayer `RoomSubmissionResult` now adds an answer-free `already-taken` status for atomic elimination claims.

Phase 7 will evolve the universal presentation contract without rewriting the Phase 1 NBA snapshot. The exact type will be finalized then, but the boundary should resemble:

```ts
type AnswerVisual =
  | { kind: "text"; label: string; primaryColor?: string; secondaryColor?: string }
  | { kind: "asset"; assetId: string; accessibleLabel: string };

type GeneralCategoryAnswer = {
  id: string;
  canonicalText: string;
  aliases: readonly string[];
  visual?: AnswerVisual;
  groupIds?: readonly string[];
};
```

An answer may have no icon at all. Team codes become one NBA adapter for `visual` and `groupIds`; other categories may use a flag, artist mark, franchise, era, element symbol, plain text monogram, or no visual. Browser clients must not accept arbitrary remote image URLs from untrusted category authors.

- Never trust browser-provided scores, challenge dates, timestamps, ownership, room state, or canonical answer IDs.
- Browser-visible Supabase configuration contains only the project URL and publishable key. No service-role or secret key enters client code.
- Tables in exposed schemas use RLS, explicit least-privilege grants, foreign keys, constraints, and indexes. Direct client writes to verified scores, deadlines, ownership, and accepted-answer state are denied.
- Privileged RPCs revoke default `PUBLIC` execution, grant only required roles, set a safe search path, validate `auth.uid()`, and enforce deadlines and ownership internally.
- Raw opponent answers and the answer bank are never sent to browsers during competitive rounds. Invalid raw submissions are not persisted.

## Phase 1 — Playable Single-Player Vertical Slice

**Status: Complete.** The game, automated tests, local checks, desktop/mobile QA, complete diff review, secret-scope review, GitHub publication, preview-only deployment, authoritative target verification, and deployed smoke test are complete. All unintended production deployments were removed, and production has zero deployments.

This phase is intentionally large enough for a separate chat: it establishes the entire frontend/tooling foundation, curates the 300-player domain dataset, implements the complete local game loop, and verifies it.

### Implementation

- [x] Scaffold the existing directory with Next.js App Router, strict TypeScript, Tailwind, ESLint, pnpm, a generated lockfile, and patched stable React/Next versions. Preserve `AGENTS.md` and all existing Git state. The current scaffold remains uncommitted.
- [x] Add Vitest and React Testing Library configuration plus real `lint`, `typecheck`, `test`, and `build` scripts.
- [x] Create a focused category domain and a versioned `current-nba-players` dataset containing exactly 30 teams and exactly 10 players per team.
- [x] Implement pure normalization and matching functions with stable canonical IDs, manual aliases, suffix handling, unique-surname aliases, and collision detection.
- [x] Add dataset tests that validate IDs, canonical names, team counts, normalized-name uniqueness, alias uniqueness, and snapshot metadata.
- [x] Add game-logic tests for normalization, matching, invalid answers, and canonical duplicate detection.
- [x] Build the homepage as a Server Component with a focused game Client Component. The game uses explicit `ready`, `playing`, `ending`, and `finished` states; an absolute client deadline; a hover/focus/hold ready zone; a clean answer board with pointer-origin liquid ripples; prefix-safe automatic exact/alias acceptance while typing; an Enter fallback; accepted, duplicate, milestone, and invalid feedback; score; accepted-answer list; and final results.
- [x] Calculate remaining time from `deadline - Date.now()` rather than decrementing a trusted counter, so background-tab throttling does not extend the round. Reject input once the deadline is reached and increase visual urgency below ten seconds.
- [x] Apply the true-white, minimal liquid-glass visual direction from `AGENTS.md`, with prediction-market-inspired hierarchy, a clean unruled answer surface, restrained pointer-reactive water ripples, responsive mobile layout, semantic form controls, visible focus states, an ARIA live feedback region, and reduced-motion-safe effects.
- [x] Add the safe local delight pass: wet-ink acceptance, fifth-answer milestone waves without scoring bonuses, duplicate-line location, optional sound/haptics, versioned local best, last-ten-second tension, a graceful input freeze, detailed local practice results, and spoiler-safe Web Share/clipboard output.
- Keep Phase 1 deliberately local and noncompetitive. The answer bank will be present in the browser bundle for local matching; Phase 2 removes it from client payloads and makes validation server-authoritative before scores become persistent.

### Tests and Acceptance Gate

- Unit tests cover whitespace, case, punctuation, apostrophes, hyphens, suffix aliases, diacritics, ambiguous aliases, invalid answers, and canonical duplicate detection.
- Dataset tests prove 300 total players, 30 recognized teams, 10 players per team, stable unique IDs, and no normalized alias collisions.
- Component tests cover keyboard and hover-dwell start, answer-surface focus and pointer-coordinate ripples, restrained transform-free typing motion, prefix-safe automatic matching, unique-surname acceptance, wet-ink/topic-icon acceptance, quick-pair ripple/notification cleanup, keyboard fallback submission, milestone waves, duplicate location, local-best and feedback preferences, blocked submissions during/after the ending transition, timer urgency, manual finish, sharing, replay, and final results. Pure helper tests cover quick-pair copy tiers, timing/team metrics, versioned/corrupt storage, and spoiler-free share text.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`; then perform a desktop and mobile smoke test.
- [x] Review the complete working-tree diff and secret scope before publication. The review passed on 2026-07-16; no staged files, `.env` files, credential-shaped values, API directories, Supabase directories, or migrations were found.
- [x] After explicit approval, create `codex/phase-1-whiteboard-preview`, commit the reviewed Phase 1 scope as `09fcb0d3b412bbb9d289dfc3a579f4fe3325a696`, and push it to `origin`.
- [x] Delete Vercel project `prj_911Yucv5Ugu7vGeLqkWunrjswBSV` and its only deployment `dpl_3jzQLEEoH6jFyU3ikSbXYYhYYwPZ`, which the connector created as `target: production` despite a preview request; verify both return `404` and the team project inventory is empty.
- [x] Establish authenticated Vercel CLI and Git-integrated preview access, create a commit-addressable preview-only deployment, verify its authoritative target and source identity, and complete the deployed smoke test.
- Phase 1 is complete only when the game is playable end-to-end and, after separate publish approval, its branch/commit is pushed and a Vercel preview is smoke-tested.

## Phase 2 — Server-Authoritative Daily Challenge

**Status: Complete.** Implementation, non-production trusted-data verification, feature-branch publication, and Vercel Preview verification pass.

- [x] Add current Supabase SSR clients with cookie-backed anonymous sessions, request-scoped clients, Next.js 16 Proxy refresh, fail-closed session establishment, and no privileged browser credential.
- [x] Add timestamped repository migrations for private category versions/answers/aliases, UTC challenges, attempts, accepted submissions, constraints, deny-all RLS/grants, deterministic 300-answer/561-alias seed data, a 30-day schedule, corrected RPC timestamp variables, and covering indexes.
- [x] Implement atomic status/resume, start, submit, and finish RPCs plus four thin no-store Route Handlers. Database time, `auth.uid()`, ownership, unique attempts/submissions, hidden alias resolution, deadlines, expiration, completion, and derived scores are authoritative.
- [x] Preserve accepted/duplicate/invalid/round-ended contracts, return only safe metadata and already-accepted presentation rows, validate UUID/answer inputs, cap JSON bodies, and provide generic errors.
- [x] Replace the competitive homepage with a narrow daily Client Component. Preserve readiness, continuous typing, automatic checks, accessibility, feedback, absolute deadline, refresh/resume, finish, verified results, responsive presentation, and spoiler-free sharing without importing the source answer bank.
- [x] Test anonymous-session reuse/creation/failure, UI start/resume/accept/duplicate/finish/missing challenge, API/runtime contracts, request bounds, seed/security invariants, deterministic regeneration, existing normalization/dataset behavior, and all Phase 1 interactions. Result: 58 passing tests across 10 files.
- [x] Run direct public-key hostile-client checks with two anonymous identities: unsigned and direct-table denial, hidden schema denial, one-attempt enforcement, independent ownership, accepted/invalid/round-ended results, concurrent duplicates, cross-user denial, arbitrary state-write denial, derived score, and idempotent finish all pass.
- [x] Run a rollback-only forced-deadline database check, live migration/schema counts, security and performance advisors, secret-scope review, production build, client-bundle audit, and local desktop/mobile route-handler smoke flow.
- [x] Push application commit `9e6c2e3754ce619f6f75585b75ebbb73d8b4b1a2`, verify deployment `dpl_uriC84X7XFDHzAZE5Wqhhzm9Xc6f` is `Ready` and `target=preview`, run the protected deployed daily flow at desktop/mobile sizes, find zero browser/error/5xx logs, and prove Production still has zero deployments.

Known limitations: Phase 2 schedules the trusted NBA category only through 2026-08-16 UTC; extending or rotating the schedule requires a reviewed migration. Duplicate presentation counts are client-session-only because invalid/duplicate raw guesses are deliberately not persisted. CAPTCHA/rate limiting, anonymous-user retention, display names, leaderboards, permanent accounts, and production deployment remain deferred. Phase 3 requires the verified attempt/finish path, a privacy-reviewed leaderboard projection, abuse controls appropriate for a broader preview, and an extended challenge schedule.

## Phase 3 — Daily Leaderboard and Preview Release

**Status: Complete.** The implementation, non-production trusted-data, hostile-client, advisor, build, bundle, GitHub publication, protected Preview, browser, and runtime-log gates pass.

- [x] Add nullable legacy-compatible `display_name` attempt data with a trusted normalization function. New names must normalize to 2–24 characters, use the documented character allowlist, and become immutable once a named attempt exists. Duplicate names are allowed and never authorize access.
- [x] Replace the no-argument start RPC with `daily_start_attempt(text)`. Existing unnamed completed/expired attempts remain ineligible; an unnamed active attempt may receive a name only when it has no submissions, preserving safe migration behavior without restart.
- [x] Add `daily_get_leaderboard()` as the fifth narrow authenticated security-definer RPC. It expires overdue attempts, derives scores from accepted rows, limits to ten, and returns only date/category version plus rank, display name, score, and equal-score tie state.
- [x] Lock ordering to score descending, completion ascending, attempt creation ascending, then internal ID as an unexposed deterministic fallback. Active and unnamed attempts are excluded; historical challenge/category-version foreign keys remain immutable.
- [x] Add a 40-answer-checks-per-10-seconds database burst guard on each owned active attempt. Database ownership, deadline, duplicate, and score invariants remain authoritative even when Route Handlers are bypassed.
- [x] Extend the deterministic version-1 NBA schedule from 2026-08-17 through 2026-12-31, producing 168 total UTC challenge dates without changing historical versions.
- [x] Build accessible name entry, one-attempt/UTC reset copy, result leaderboard, loading, empty, unavailable, forced-offline error, retry, and tie guidance while preserving the accepted-answer timeline, sound preference, reduced motion, sharing, and mobile layout.
- [x] Pass 66 automated tests across 11 files, rollback-only live migration validation, direct public-key hostile checks, zero direct table grants, zero score mismatches, five-RPC inspection, advisors, production build, client-bundle audit, and local 1440×1000/390×844 real-backend browser QA.
- [x] Commit application scope as `a169bc12ccf4e6eb386d9ff3c53181ca22b39b54`, push only `codex/phase-3-daily-leaderboard-preview`, verify exact-source protected Preview `dpl_76HfnTfCiJzhXciMskCWkwzHi7ck` is `READY` and `target=preview`, pass the desktop/mobile flow without browser/runtime errors, find no 5xx responses, and confirm Production has zero deployments and variables.

Known limitations: rejected/duplicate raw guesses are not persisted, so duplicate counts remain client-session-only. The non-production hostile suite intentionally creates disposable anonymous QA users/attempts; cleanup should target only users linked to `daily_attempts.display_name like 'QA %'` in this project after an explicit count/review, relying on the existing auth-user cascade. No cleanup job or retention deletion policy was created. CAPTCHA is not configured because Supabase requires a selected hCaptcha or Cloudflare Turnstile site/secret pair and frontend token flow; keep the preview team-auth protected until that choice is supplied. Global averages, percentiles, rarity, histories, streaks, and other community metrics remain deferred rather than fabricated.

## Phase 4 — Secure Private Room Lobby

**Status: Complete.** Built on the stable deployed daily architecture and anonymous identity.

- [x] Add rooms and players with internal UUIDs, eight-character non-ambiguous public codes, `waiting/active/completed/cancelled` states, `private_race` mode allowlisting, indexed host linkage, and unique room/user membership.
- [x] Implement create, safe status, join/rejoin, and host-only start as atomic authenticated database operations. The database locks capacity at eight, sets the 90-second start/deadline timestamps, and denies late joins.
- [x] Keep room/player tables RLS-enabled and deny-all. Outsiders with a valid invite receive category, status, and count but no participant identities; joined members receive only safe participant metadata and no answer data.
- [x] Build `/room`, `/room/[roomCode]`, four no-store Route Handlers, shareable URL handling, copy feedback, participant/capacity rows, host controls, five-second refresh recovery, and a last-seen-derived disconnected display.
- [x] Pass 78 automated tests, a direct publishable-key room hostile suite, zero direct table grants, zero unsigned room RPCs, exactly four authenticated room RPCs, security/performance advisors, build, bundle audit, and diff validation.
- [x] Prove stable duplicate rejoin, immutable membership names, an atomic two-client final-slot race, cross-session projection, non-host start denial, arbitrary status/deadline write denial, host timestamps, and late-join rejection.
- [x] Commit application scope as `84731004b12b151c22eff3b1e34a31ddbf3db3e8`, push only `codex/phase-4-secure-room-lobby`, verify exact-source protected Preview `dpl_9NjNPMpW3bshp43RPdQYWA6FRDCr` is `READY` and `target=preview`, and pass the desktop/mobile two-session deployed gate with only 200/204 responses and no browser/runtime errors.

Known limitations: Phase 4 intentionally stops at the secure lobby boundary. Starting locks the room and shows a truthful handoff state; private answer submissions, Realtime presence/typing, opponent boards, synchronized gameplay, and post-round reveal begin in Phase 5. The heartbeat-derived `connected` flag is deliberately approximate until Realtime Presence is introduced. Host transfer, room cancellation UI, abandonment cleanup, and retention jobs remain deferred. QA created disposable rooms/anonymous users; cleanup requires an explicit count/review and must rely on the auth-user cascade rather than broad deletion.

## Phase 5 — Live Private-Race Multiplayer

**Status: Complete.** Built on the secure room lobby and authorization model from Phase 4.

- [x] Add per-player accepted submissions and safe player-state counts. A canonical answer may score once per player in private-race mode.
- [x] Use Supabase Presence for connectivity and authorized Broadcast for typing/empty board-change signals. Typing payloads contain only a boolean typing state and coarse length bucket; receiver identity comes from the private topic.
- [x] Render the local player's accepted answers and synthetic opponent bars/counts. Active-round RPC projection, RLS, and grants prevent opponent answer retrieval through REST, Realtime, HTML, or serialized React state.
- [x] Apply the equal-board liquid-glass direction with safe synthetic blurred typing indicators, restrained score motion, responsive stacking, reconnect fallback, and reduced-motion behavior.
- [x] Finish/reveal results only after the server deadline. Hostile tests cover independent simultaneous scoring, duplicates, invalid guesses, deadline agreement, active privacy, direct-table denial, and unauthorized channel subscribe/publish.
- [x] Pass the gate in separate in-app and Chrome sessions: create, join, start, submit different answers, synchronize safe counts, hide active answers, and reveal both verified lists after completion.

Known limitations: private race intentionally has no host transfer, cancellation UI, abandonment cleanup job, retained room-history UI, or elimination claims. Presence is best-effort connection presentation rather than scoring authority. A Chrome extension injected Grammarly attributes during one development hydration, producing an extension-caused console message; the clean in-app browser and production build do not reproduce an application hydration mismatch.

## Phase 6 — Atomic Elimination Mode

**Status: Complete.** Built on the working private-race multiplayer path from Phase 5.

- [x] Extend the room mode union with `elimination` while preserving `private_race` as default and keeping the original one-argument creator compatible.
- [x] Implement a transactional claim path with a unique `(room_id, answer_id)` invariant. The first valid claim scores; concurrent losers receive `already-taken` without answer or owner data.
- [x] Add an accessible mode picker, elimination-specific live feedback, claim language, and final ownership results without changing private-race behavior.
- [x] Test true concurrent submissions, winner retries, cross-room isolation, deadline rejection, active secrecy, direct-table denial, and private-race regression coverage.
- [x] Pass the gate: hostile database concurrency and a real two-browser race both prove exactly one owner per canonical answer per room.

Known limitations: elimination currently shares Phase 5's fixed NBA category, 90-second room rule, eight-player cap, best-effort Presence display, and deferred host-transfer/cancellation/cleanup/history work. Disconnected players retain valid server-owned claims; there is no reclaim mechanic. Production and broader unprotected access remain deferred.

## Phase 7 — General Category Studio and Discovery

**Status: Not started.** Begin only after the Phase 1 publication gate and the trusted identity, category versioning, verified scoring, and leaderboard foundations are complete. This phase makes the product broadly category-first without allowing unreviewed generation into competitive play.

- Generalize `Category`, `CategoryAnswer`, result metrics, icon rendering, and coverage summaries so teams and leagues are optional category-specific metadata rather than universal fields.
- Turn the ready-state headline into an accessible editable combobox. Debounced server recommendations return reviewed category versions using moderated aggregate usage, support keyboard/touch selection, and provide clear loading, empty, offline, and error states.
- Keep category selection and category creation distinct. If no trusted category matches, route the player to a draft flow that records prompt, provenance, source notes, answer-bank coverage, aliases, icon metadata, immutable version, review status, and competitive eligibility.
- Treat assisted or AI-produced answer banks as untrusted drafts. Run deterministic normalization, canonical/alias collision checks, size and quality validation, moderation, and an explicit review step. Unreviewed drafts remain practice-only and cannot enter daily leaderboards, public recommendations, or competitive rooms.
- Add privacy-preserving popularity aggregates with minimum-sample and recency rules. Recommendations must not reveal private prompt history or expose raw unmoderated user text.
- Add a sparse atmospheric ready-state layer containing a few slowly drifting liquid-glass cards for real popular prompts, verified high scores, active public lobbies, or tiny aggregate trends. Cards remain secondary to the prompt, avoid its interaction path, respect reduced motion, and collapse cleanly on mobile or when data is absent.
- Add moderation, rate limiting, abuse reporting, copyright/provenance handling, category correction/version workflows, and tests for recommendation privacy, stale aggregates, malicious prompt text, eligibility boundaries, accessibility, and mobile motion behavior.
- Gate: users can discover reviewed categories across unrelated subjects and create clearly labeled practice drafts without fake community metrics, cross-user prompt leakage, ambiguous validation, or accidental ranked eligibility.

## Phase 8 — Production Hardening and Launch

**Status: Not started.** Applies after the core daily, general-category, and multiplayer flows are complete.

- Add abuse controls for anonymous sign-in, answer submission, room creation, and room joining using the available deployment-layer rate limiting; keep database invariants as the final authority.
- Add anonymous-user and abandoned-room retention jobs with documented periods, while preserving aggregate leaderboard results and deleting/minimizing raw transient data.
- Complete accessibility, mobile, privacy, secret-exposure, dependency, RLS, and authorization reviews; run Supabase security/performance advisors and the full unit/component/E2E/build suite.
- Verify GitHub protection/release flow, production-specific Supabase and Vercel configuration, reviewed migrations, deployed commit identity, production smoke tests, and rollback steps before declaring launch complete.

## Deferred Product Roadmap — Documented, Not Authorized or Started

These ideas are deliberately recorded without client-trusted placeholders or premature infrastructure. They may enter a numbered phase only after the current gate and prerequisite security model are complete.

### Daily and Retention

- Daily streaks and a challenge archive, backed by server-authoritative attempt history.
- Global percentile, average score, answer rarity, and most-missed answers, with minimum-sample and privacy rules.
- Personal statistics and score history; badges and achievements derived only from verified attempts.
- Weekly themed challenges and leaderboards, monthly recaps, and a privacy-conscious “NameMore Wrapped.”
- Category playlists, bookmarks, recently played, and random selection after Phase 7 establishes reviewed multi-category discovery.

### Additional Game Modes

- Solo/practice candidates: Classic, Blitz, Marathon, Zen practice, Sudden Death, Perfect Ten, Team Sweep, Alphabet Run, One Per Team, Survival, and Mystery Category.
- Multiplayer candidates: Draft, Relay, team modes, and custom-room settings. Each mode requires explicit server-owned rules, timing, scoring, authorization, and testable result semantics before implementation.

### Expanded Multiplayer Experience

- Asynchronous challenge links, best-of-three series, instant rematch, verified rival records, post-round answer overlap, and cinematic answer reveal.
- Spectator mode and tournaments remain post-launch concepts and must not expose active-round answers or widen room authorization.
- Elimination mode remains Phase 6 and requires atomic canonical-answer claims; it must never be simulated with client-side locks.

For every future multiplayer feature: never send raw opponent typing or answers during an active round; CSS blur is not a security boundary; broadcast only safe typing state and a coarse length bucket; and keep validation, ownership, timing, scoring, deadlines, and reveal permissions server-authoritative under RLS and least-privilege grants.

## Cross-Chat Handoff Template

At the end of every phase, record:

1. Files and migrations changed.
2. Commands/checks run and exact results.
3. Git/Supabase/Vercel actions actually completed.
4. Remaining known limitations or blockers.
5. The next phase's prerequisites and acceptance gate.

## Immediate Next Handoff

Current handoff facts:

- Phase 6 is complete on `codex/phase-6-atomic-elimination`; application commit `1781efe1ca641d26f2607103b1b833d5ceb5d8ab` is pushed and exact-source protected Preview `dpl_GDCbaEUg19nSxAGdKBPKzkPfg6HU` is `READY`.
- Non-production Supabase has twelve applied repository migrations, twelve narrow gameplay/status RPC signatures plus one Realtime authorization helper, zero direct application-table grants, a deny-all claim table, and private member-scoped per-player topics.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` (94 tests across 16 files), `pnpm build`, `pnpm audit:client-bundle`, and `git diff --check` pass. All four direct hostile-client suites pass with Preview-scoped public configuration.
- Elimination hostile checks prove one atomic owner under simultaneous submission, answer-free losers, retries, cross-room isolation, deadline behavior, direct-claim denial, unchanged private-race scoring, active secrecy, and completed ownership reveal.
- Desktop/mobile visual QA passed without horizontal overflow or browser errors. Separate in-app and Chrome sessions raced for the same canonical answer, saw exactly one claim and one safe rejection, then saw identical server-verified ownership results after the deadline.
- Security advisor findings remain the intentional deny-all/no-policy, narrowly granted RPC, member-constrained anonymous Realtime, and deferred password-account notices. Performance has only expected unused-index notices on the fresh schema. Preview-only environment variable names are unchanged; Production is untouched.

The next milestone is Phase 7’s general category studio and discovery. Preserve the trusted daily/room identity, server clock, deny-all direct-table posture, reviewed versioned answer banks, active answer secrecy, private Realtime topics, atomic elimination claims, and protected Preview-only deployment policy. Generalize category presentation, add an editable reviewed-category combobox and distinct practice-draft creation flow, and use only moderated real aggregates for ambient cards; do not fabricate activity, admit unreviewed drafts to competitive play, merge `main`, deploy Production, or configure CAPTCHA without explicit authorization and provider credentials.
