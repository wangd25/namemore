# NameMore Implementation Plan

## Current Findings

- Phase 7A is complete on `codex/phase-7-category-discovery`. One forward-only migration adds the curated discovery catalog, private owned draft storage, real thresholded ambient aggregates, hourly draft limiting, and two narrow authenticated RPCs. The migration is applied to non-production Supabase; application commit `5db1edf90674a484daa74fb6a02e6328874d2c3f` is pushed, and exact-source protected Preview `dpl_J7QnKCxwXBEL3Z44FEWnLwvVxaam` is `READY` with `target: preview`. Local 1440×1000 and 390×844 plus protected mobile discovery/search/draft/daily QA, advisors, grants, lint, typecheck, 103 tests, build, bundle audit, runtime logs, Production isolation, and whitespace checks pass.
- Phase 7B is complete on `codex/phase-7b-general-practice`. A fourteenth forward-only migration adds optional category-neutral answer visual/group metadata and the reviewed noncompetitive 118-answer/240-alias Chemical Elements version. Application commit `88610dc9925e1622d85e43b216c32059bbcc1709` is pushed, and exact-source protected Preview `dpl_9NM5LRnJUnmnPwQYyd7EoaxDRWyF` is `READY` with `target: preview`. The static practice route, category-specific input/source copy, symbol rendering, generic coverage/results/sharing, local desktop/mobile QA, protected route/API smoke, 110 tests, lint, typecheck, build, homepage bundle audit, live grants/count inspection, runtime logs, and Production isolation pass.
- Phase 7C1 is complete on `codex/phase-7c-draft-review`. A fifteenth forward-only migration adds owner-only draft listing/editing and an irreversible `review-requested`/`pending` submission transition. Application commit `fba54bb244d0f87f9e93a1bcb1418d58e4738a85` is pushed; exact-source protected Preview `dpl_FvSgqjYRg8qmSN3c16BGhDxXkJCe` is `READY` with `target: preview`. The responsive workspace, no-store handlers, 114 tests, category-draft hostile-client suite, lint, typecheck, build, bundle audit, live grants/constraint inspection, advisors, desktop/mobile browser flow, protected page/API smoke, runtime logs, and Production isolation pass.
- Phase 7C3 is complete on `codex/phase-7c3-answer-bank-versions`. Two forward-only migrations add private versioned answer-bank metadata, canonical answers, aliases, deterministic accent-insensitive normalization, immutable freeze/correction lifecycle, foreign-key indexes, and five narrow reviewer-only RPCs without publishing or eligibility. Application commit `2b401b866d8cb90e491708de942d396b91e0e2be` is pushed; exact-source protected Git Preview `dpl_5g3Fv7hEVSjpQBCho4naDXhkz4pk` is `READY`, target null, and matches that commit. The reviewer bank workspace, no-store handlers, 135 tests, rollback integration, live inspection, desktop/mobile browser flow, protected boundary smoke, runtime logs, and Production isolation pass.
- Phase 7C4 is complete on `codex/phase-7c4-answer-bank-decisions`. One forward-only migration adds an append-only deny-all decision snapshot per frozen bank revision and two narrow authenticated RPCs for an independent queue and request-correction/reject/approve decisions. Application commit `99d0acc4b1da5bd236effd6d0ec165d4e4e3929b` is pushed; exact-source protected Git Preview `dpl_23hthHcsTUk42up2B7jdS296U8ws` is `READY`, `target: preview`, and matches that commit. Owner/editor self-review denial, correction-only revision copying, terminal private approval, 144 tests, hostile-client checks, live inspection, desktop/mobile browser flow, protected page/API smoke, runtime logs, and Production isolation pass.
- Phase 7C5 is complete on `codex/phase-7c5-approved-bank-publishing`. One forward-only migration adds a deny-all publisher allowlist, immutable publication snapshots, and four narrow authenticated RPCs for status, queue, atomic reviewed-practice publication, and dynamic practice projection. Application commit `a84bc22d521102f439feba1811b53b8061103857` is pushed; exact-source protected Git Preview `dpl_2KYohYZRwNfd94gi3MdZP4nuv9kY` is `READY`, target null, and matches that commit. Independent publisher separation, 155 tests, hostile-client checks, live inspection, real desktop/mobile publish → discovery → dynamic-practice flow, protected HTTP/runtime logs, and Production isolation pass.
- Phase 7C6 is complete locally on `codex/phase-7c6-practice-supersession`. One forward-only migration adds deny-all correction requests, immutable publication provenance links, a publisher correction RPC, and successor-aware queue, revision, and publication functions. The current version stays live until the original editor's copied revision passes freeze, independent approval, and independent publication; the successor preserves the slug, advances discovery atomically, retains every predecessor, and remains unranked. All 157 tests, hostile-client checks, live non-production inspection, desktop/mobile release-ledger QA, production build, and client-bundle audit pass.
- Phase 6 is complete on `codex/phase-6-atomic-elimination`. One forward-only migration adds the deny-all claim table, unique `(room_id, answer_id)` first-owner invariant, mode-aware room creation, and atomic answer submission while preserving the one-argument private-race creator. Application commit `1781efe1ca641d26f2607103b1b833d5ceb5d8ab` is pushed; exact-source protected Preview `dpl_GDCbaEUg19nSxAGdKBPKzkPfg6HU` is `READY` and passed protected homepage/room/current-daily smoke, runtime error/5xx, two-browser simultaneous-claim, answer secrecy, ownership reveal, and desktop/mobile visual gates.
- Phase 5 is complete on `codex/phase-5-live-private-race`. Three forward-only migrations add deny-all per-player submissions, canonical per-player uniqueness, answer-check burst control, server-authoritative game/submit/reveal RPCs, a corrective foreign-key index, and private per-player Realtime authorization. Application commit `cba8380e8b93d65383b9c0342aa6fc172b5e73c3` is pushed; exact-source protected Preview `dpl_ADAE2bevosLdTLLMof3LKp478QvE` is `READY` and passed protected smoke/error-log checks. Separate in-app and Chrome sessions completed the same private race with synchronized safe counts, hidden active answers, and server-deadline reveal.
- Phase 4 is complete on `codex/phase-4-secure-room-lobby`. Two forward-only migrations add deny-all room/player tables, indexed host linkage, non-ambiguous codes, unique membership, atomic capacity and host-only start enforcement, plus four narrow authenticated RPCs. Application commit `84731004b12b151c22eff3b1e34a31ddbf3db3e8` is pushed; exact-source protected Preview `dpl_9NjNPMpW3bshp43RPdQYWA6FRDCr` passed the two-session desktop/mobile create, join, refresh, synchronize, start, console, overflow, HTTP, and runtime-log gates.
- As of 2026-07-18 UTC, Phase 2 is complete. It passed local/non-production Supabase, direct hostile-client, advisor, bundle-leak, GitHub publication, and local/deployed desktop/mobile browser gates.
- Phase 3 is complete on `codex/phase-3-daily-leaderboard-preview`. Its two reviewed migrations are applied to the confirmed non-production project, application commit `a169bc12ccf4e6eb386d9ff3c53181ca22b39b54` is pushed, and exact-source protected Preview `dpl_76HfnTfCiJzhXciMskCWkwzHi7ck` passed desktop/mobile flow, HTTP, console, overflow, runtime error/5xx, and Production-isolation gates.
- The focused post–Phase 3 branch `codex/daily-ready-spring-latency` hardens transient empty-status recovery, replaces the ready dwell's linear loading feel with damped spring charge/launch motion, and reduces competitive automatic-check debounce from 420ms to 180ms with an immediate pending cue. On 2026-07-20 UTC, the non-production database was independently verified to have one active challenge today and a continuous 168-day schedule through 2026-12-31; no schema or trusted-data change was needed. Application commit `49d1687c65e05a3d060983b39693363490ef134a` is pushed, and exact-source protected Preview `dpl_AAN9cqyDdoSspYU1NYqikypwTEiD` passed its desktop/mobile daily flow, answer-latency, console, overflow, and runtime-log gates.
- `codex/phase-2-server-authoritative-daily` adds cookie-backed Supabase anonymous sessions, Next.js 16 Proxy/session refresh, four thin daily Route Handlers, runtime-validated safe contracts, and a narrow daily game Client Component that never imports the answer bank.
- Non-production Supabase project `namemore` (`hutmxxlicxeaovoeqbwg`) has anonymous sign-in enabled and nineteen applied repository-owned migrations. It contains 418 reviewed canonical answers and 801 aliases across the immutable NBA and Chemical Elements versions; Phase 7C4 adds only private bank-decision evidence and operations, with all QA review data removed.
- The database contains 418 canonical answers and 801 normalized aliases in the unexposed `private` schema. Application tables have RLS enabled with no permissive direct browser policies. Direct table privileges are revoked; twenty-seven gameplay/status/discovery/draft/review/bank RPC signatures plus one Realtime authorization helper enforce `auth.uid()`, membership, ownership, deadlines, atomic uniqueness/capacity/claims, immutable names, independent review authority, host authority, derived scores, active-answer secrecy, safe discovery, and private draft/bank state.
- Vercel project `namemore` contains only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, scoped to Preview. No Production variables or deployments were changed.
- `pnpm test` passes 144 tests across 26 files. `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm audit:client-bundle`, and `git diff --check` pass. The direct public-key hostile suites include independent answer-bank decision coverage. Phase 7C4 local browser QA covers the real frozen-bank approval flow, desktop/mobile concept fidelity, console diagnostics, and overflow.
- As of 2026-07-17, the Phase 1 implementation and local checks are complete. The 34-path publication scope was re-audited successfully, committed as `09fcb0d3b412bbb9d289dfc3a579f4fe3325a696` on `codex/phase-1-whiteboard-preview`, and pushed to `origin`.
- The homepage renders the responsive NameMore local practice game with `ready`, `playing`, `ending`, and `finished` states, an absolute-deadline timer, hover/focus/press-and-hold readiness, continuous typing with automatic exact/alias acceptance, keyboard fallback submission, feedback, scoring, accepted answers, manual finish, and replay.
- NameMore is now category-first at entry: the homepage headline is an editable reviewed-catalog composer with a distinct private draft path. NBA is the trusted competitive daily; Chemical Elements is the first fully reviewed unrelated local-practice bank.
- The homepage includes a sparse ambient layer of slowly drifting liquid-glass cards for the real current-daily best, minimum-sample popularity, and recent room activity. Cards remain secondary, reduced-motion-safe, mobile-aware, and absent when trusted aggregate data is unavailable; fabricated activity is prohibited.
- The interface uses the Apple system font stack on a true-white, prediction-market-inspired canvas. One nearly full-viewport translucent liquid-glass board contains a compact timer/score HUD and a clean unruled whiteboard with borderless in-board typing. Pointer-origin liquid ripples react on the ready and writing surfaces without per-movement React renders.
- The completed local delight pass adds wet-ink answer settling, a board-wide milestone wave every five answers, duplicate-line highlighting, optional failure-safe sound/haptics with a slightly louder two-note accepted-answer chime, a versioned local-practice best, final-ten-second tension, a graceful ending freeze, detailed local results, and explicitly activated spoiler-safe sharing.
- The current playing surface is near full-bleed, with a restrained transform-free 90ms typing response and a spring-check/stronger-team-color-wash acceptance treatment. Reusable answer icon slots sit directly beside names and currently render compact NBA team marks. Two answers within 2.5 seconds trigger a board-wide green liquid ripple and a temporary notification with measured timing and tiered natural copy. Local practice keeps its 420ms prefix-conflict wait; the server-authoritative daily begins secure automatic checks after a 180ms typing pause and shows a small pending cue while preserving the private answer bank. The pointer effect is a compact 46px desktop/36px mobile lens that follows mouse position without looping or appearing solely from keyboard focus.
- Local results calculate only available practice data: score, local best, answers per minute, acceptance timeline, shortest accepted-answer gap, longest pause, duplicate attempts, and optional category-defined coverage such as NBA teams or element periods. Global averages, percentiles, rarity, and other-user statistics remain deferred until trusted server data exists.
- `lib/categories.ts` contains a versioned 2026-07-15 NBA snapshot with 30 teams, 10 players per team, and 300 canonical answers.
- `lib/normalize.ts` and `lib/game-logic.ts` implement deterministic normalization, canonical lookup construction, explicit aliases, unique-surname aliases, and collision detection.
- Vitest and React Testing Library run 58 passing unit, dataset, component, contract, request-boundary, session, and migration tests across 10 test files.
- There is no permanent account, general analytics dashboard, CAPTCHA integration, or production deployment.
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
| 7. General category studio and discovery | **In progress** | Phases 7A–7C6 ship editable discovery, reviewed general practice, private drafts, scope/bank review, approved-bank publishing, and immutable practice supersession; moderation and abuse-reporting workflows remain. |
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

**Status: In progress.** Phases 7A–7C5 are published and Preview-verified. Phase 7C6 is complete locally on `codex/phase-7c6-practice-supersession`, including its non-production Supabase migration, and is awaiting its exact-source protected Preview. This phase makes the product broadly category-first without allowing unreviewed generation into competitive play.

- [x] Generalize `Category`, `CategoryAnswer`, result metrics, icon rendering, and coverage summaries so teams and leagues are optional category-specific metadata rather than universal fields.
- [x] Add a reviewed 2022-05-04 IUPAC Chemical Elements snapshot with 118 canonical names, symbol aliases, four documented alternates, atomic-number ordering, period coverage, source/version copy, and explicit noncompetitive local-practice eligibility.
- [x] Turn the homepage headline into an accessible multiline editable combobox. A 180ms no-store server search returns only curated catalog rows, supports keyboard/touch selection, and provides loading, empty, offline, and error states.
- [x] Keep category selection and category creation distinct. The first draft flow records prompt, provenance/source notes, and coverage boundaries in private deny-all storage. Constraints force `draft`, `unreviewed`, and `competitive_eligible = false`; five creations per hour are allowed per anonymous owner.
- [x] Let an owner list and edit only their own drafts through bounded no-store handlers and authenticated RPCs. Submitting for review atomically locks editing and records `review-requested`/`pending`; it does not generate answers, publish, approve, or change competitive eligibility.
- [x] Require explicit private reviewer authority, prevent self-review, preserve an immutable evidence snapshot per submitted revision, require a normalized decision reason, and expose only reviewer-free outcomes to owners. Request changes reopens owner editing; rejection and scope approval are terminal for that revision. No outcome creates answers, publishes, or changes eligibility.
- [x] Add a private versioned answer-bank workspace for scope-approved, non-owned category drafts. Require dated HTTPS provenance and bounded notes, canonical answers, and explicit aliases; apply deterministic accent-insensitive normalization and collision checks in both client validation and the database; freeze immutable review-ready snapshots and start corrections as copied new revisions. Frozen banks remain unpublished, unplayable, owner-hidden, discovery-hidden, and competitively ineligible.
- [x] Require an independent decision for each frozen bank revision. Exclude both the category owner and bank editor; record one append-only evidence snapshot; require a reason for request-correction, reject, or approve; and allow only the original editor to copy a changes-requested revision. Approval remains private, unpublished, unplayable, and competitively ineligible.
- [x] Add a separate publisher-controlled transition after bank approval. Exclude the category owner, bank editor, and approving reviewer; copy the locked snapshot atomically into immutable category data, reviewed discovery, and dynamic local practice; record an immutable publication snapshot; and force `practice`/noncompetitive eligibility. Duplicate publication and ranked/daily/room admission remain blocked.
- [x] Add published-practice correction and supersession without mutable history. Only an independent publisher can request correction; only the original editor can copy the current release into a new bank revision; the revision must pass the existing freeze, independent approval, and publisher boundaries. Atomically publish an exact-slug successor, retain linked release provenance, move discovery to the successor, and keep every version noncompetitive.
- Treat assisted or AI-produced answer banks as untrusted drafts. Require moderation and the same separate publishing step after bank approval. Unpublished drafts remain unavailable to practice and cannot enter daily leaderboards, public recommendations, or competitive rooms.
- [x] Add privacy-preserving aggregates: the current verified daily best, popularity only after three completed named rounds, and recent waiting/unexpired active room counts. No draft text or private prompt history enters discovery.
- [x] Add a sparse atmospheric homepage layer containing up to three slowly drifting real-data cards. Cards remain outside the composer path, respect reduced motion, collapse to one on mobile, and disappear when data is absent.
- Add moderation, rate limiting, abuse reporting, and copyright/provenance administration, with tests for recommendation privacy, stale aggregates, malicious prompt text, eligibility boundaries, accessibility, and mobile motion behavior.
- Gate: users can discover reviewed categories across unrelated subjects and create clearly labeled practice drafts without fake community metrics, cross-user prompt leakage, ambiguous validation, or accidental ranked eligibility.

Phase 7A verification: `pnpm test` passes 103 tests across 19 files; lint, strict typecheck, production build, client-bundle audit, and `git diff --check` pass. The thirteenth non-production migration is applied; catalog rows, answer counts, grants, safe search paths, authenticated execution, RLS, and advisors were inspected. Desktop/mobile browser QA passed real discovery, search, selection, draft navigation, `/daily` regression, console, and overflow checks.

Phase 7B verification: `pnpm test` passes 110 tests across 20 files; lint, strict typecheck, production build, homepage client-bundle audit, and `git diff --check` pass. The fourteenth non-production migration is applied; exactly 118 element answers/240 aliases, optional metadata, catalog eligibility, direct-table denial, and grants were inspected. Desktop/mobile local QA passed catalog selection, full-name/symbol/alternate acceptance, category-neutral play/results/share, console, and overflow checks. Application commit `88610dc9925e1622d85e43b216c32059bbcc1709` is pushed; exact-source protected Preview `dpl_9NM5LRnJUnmnPwQYyd7EoaxDRWyF` is `READY`, `target: preview`, and passed homepage/practice/discovery HTTP plus runtime-log gates. Production has zero deployments. At the Phase 7B handoff, draft editing/review/publishing, category correction/versioning, moderation/abuse workflows, and hostile-client draft ownership/rate-limit coverage remained.

Phase 7C1 verification: `pnpm test` passes 114 tests across 20 files; lint, strict typecheck, production build, client-bundle audit, and `git diff --check` pass. The fifteenth non-production migration is applied; its three new owner draft RPCs are security-definer functions with explicit safe search paths, authenticated-only grants, and no anonymous execution. The direct hostile-client suite passes authentication, direct-table denial, owner isolation, cross-owner denial, five-per-hour limiting, normalized updates, irreversible review submission, and discovery privacy. Local browser QA passes create/edit/save/submit/lock and new-draft reset behavior with no warnings/errors or horizontal overflow at desktop and 390×844. Remaining Phase 7 work is reviewer authority, review outcomes/publishing, corrections/versioning, moderation/provenance administration, and abuse reporting.

Phase 7C1 publication: application commit `fba54bb244d0f87f9e93a1bcb1418d58e4738a85` is pushed; exact-source protected Preview `dpl_FvSgqjYRg8qmSN3c16BGhDxXkJCe` at `https://namemore-opmrsg9nc-namemore.vercel.app` is `READY`, `target: preview`, and passed `/category/new`, draft-list contract, runtime error/fatal, and Production-isolation gates.

Phase 7C2 verification: `pnpm test` passes 124 tests across 22 files; lint, strict typecheck, production build, client-bundle audit, and `git diff --check` pass. The sixteenth migration is applied to non-production Supabase with 418 answers/801 aliases unchanged, three authenticated reviewer RPCs, two private deny-all reviewer tables, zero invalid pending revisions, and only the expected advisor notices. The category-review hostile-client suite passes explicit allowlisting, direct-table and outsider denial, self-review prevention, immutable revision snapshots, request-changes/resubmission, owner-visible reasons without reviewer identity, noncompetitive scope approval, and discovery privacy. Local in-app-browser QA passes ordinary-user denial, authorized queue/decision advancement, desktop/mobile concept fidelity, console, and overflow gates. Application commit `c508d739748854ed6782e00452f130dc0164e5f1` is pushed; exact-source protected Preview `dpl_Ag13tXpPKyJEk5GjbY16R3GNPGA1` is `READY`, the ordinary-user review API returned the safe unauthorized contract, runtime error/fatal/5xx scans were empty, and Production has zero deployments.

Phase 7C3 verification: `pnpm test` passes 135 tests across 24 files; lint, strict typecheck, production build, client-bundle audit, and `git diff --check` pass. The seventeenth and eighteenth migrations are applied to non-production Supabase with the existing 418 answers/801 aliases unchanged, three private bank tables, five authenticated bank RPCs, zero direct browser table grants, and covering foreign-key indexes. Server normalization maps `Luka Dončić` to `luka doncic`; the rollback integration rejects accent and cross-answer collisions, freezes immutable revision 1, and copies revision 2. Local real-backend QA passes open/validate/freeze/lock/correct, accepted concept fidelity at 1440×1000 and 390×844, exact mobile action order, console, and overflow gates; the fixture and temporary reviewer were removed. Application commit `2b401b866d8cb90e491708de942d396b91e0e2be` is pushed; exact-source protected Git Preview `dpl_5g3Fv7hEVSjpQBCho4naDXhkz4pk` is `READY`, source `git`, target null, and matches the commit. Its ordinary-user page/API, browser error, runtime error/fatal/5xx, and Production-isolation gates pass.

Phase 7C4 verification: `pnpm test` passes 144 tests across 26 files; lint, strict typecheck, production build, client-bundle audit, and `git diff --check` pass. The nineteenth migration is applied to non-production Supabase with 418 answers/801 aliases unchanged, one private deny-all review table, two authenticated decision RPCs, zero anonymous/public execution, and only the expected deny-all/security-definer advisor notices. The public-key hostile suite passes direct-table and outsider denial, category-owner and bank-editor self-review denial, immutable decision snapshots, correction-only revision copying by the original editor, terminal private approval, discovery privacy, and noncompetitive state. Local real-backend QA passes the frozen-bank approval flow, accepted concept fidelity at 1440×1000 and 390×844, mobile action order, console, and overflow gates; all fixtures and temporary reviewers were removed. Application commit `99d0acc4b1da5bd236effd6d0ec165d4e4e3929b` is pushed; exact-source protected Git Preview `dpl_23hthHcsTUk42up2B7jdS296U8ws` at `https://namemore-k9nuebmc0-namemore.vercel.app` is `READY`, `target: preview`, and matches the commit. Its protected page, ordinary-user API, runtime error/5xx, and Production-isolation gates pass.

Phase 7C5 verification: `pnpm test` passes 155 tests across 29 files; lint, strict typecheck, production build, client-bundle audit, and `git diff --check` pass. The twentieth migration is applied to non-production Supabase with the baseline 418 answers/801 aliases unchanged after QA, two new private deny-all tables, four authenticated publishing/practice RPCs, zero direct browser table grants, and only the expected deny-all/security-definer/unused-fresh-index advisor notices. The public-key hostile suite passes ordinary-user/direct-table denial, independent-publisher separation, invalid and duplicate rejection, immutable atomic category/answer/alias/discovery publication, safe dynamic practice projection, and permanent noncompetitive state. Local real-backend QA passes approved-bank metadata editing, publication, homepage discovery, dynamic practice, and alias acceptance; accepted desktop/mobile concept comparison, mobile action order, console, and horizontal-overflow gates pass. All fixtures and allowlist entries were removed, returning the database to 2 category versions, 418 answers, 801 aliases, and 3 discovery items. Application commit `a84bc22d521102f439feba1811b53b8061103857` is pushed; exact-source protected Git Preview `dpl_2KYohYZRwNfd94gi3MdZP4nuv9kY` at `https://namemore-qbmg750bj-namemore.vercel.app` is `READY`, source `git`, target null, and matches that commit. Its protected publisher page, ordinary-user API, homepage/practice regression, runtime error/fatal/5xx, and Production-isolation gates pass.

Phase 7C6 verification: `pnpm test` passes 157 tests across 29 files; lint, strict typecheck, production build, client-bundle audit, and `git diff --check` pass. The twenty-first migration is applied to non-production Supabase with the baseline 418 answers/801 aliases unchanged after QA, one new private deny-all correction-request table, successor provenance constraints, and authenticated-only correction/supersession execution. The expanded public-key hostile suite passes direct-table and unauthorized-role denial, publisher-only correction, editor-only copied revision, independent reapproval, exact-slug enforcement, atomic version-2 publication, immutable version-1 counts, current practice resolution, and permanent noncompetitive state. Local real-backend QA passes the two-release ledger and correction-pending flow at 1440×1000 and 390×844 with accepted-concept fidelity, no console errors, and no horizontal overflow. All fixtures and temporary role entries were removed, returning the database to 2 category versions, 418 answers, 801 aliases, and 3 discovery items.

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
- Phase 7A is complete on `codex/phase-7-category-discovery`; application commit `5db1edf90674a484daa74fb6a02e6328874d2c3f` is pushed and exact-source protected Preview `dpl_J7QnKCxwXBEL3Z44FEWnLwvVxaam` is `READY` with `target: preview`.
- Phase 7B is complete on `codex/phase-7b-general-practice`; application commit `88610dc9925e1622d85e43b216c32059bbcc1709` is pushed and exact-source protected Preview `dpl_9NM5LRnJUnmnPwQYyd7EoaxDRWyF` is `READY` with `target: preview`.
- Phase 7C1 is complete on `codex/phase-7c-draft-review`; application commit `fba54bb244d0f87f9e93a1bcb1418d58e4738a85` is pushed and exact-source protected Preview `dpl_FvSgqjYRg8qmSN3c16BGhDxXkJCe` is `READY` with `target: preview`.
- Phase 7C2 is complete on `codex/phase-7c2-reviewer-authority`; application commit `c508d739748854ed6782e00452f130dc0164e5f1` is pushed and exact-source protected Preview `dpl_Ag13tXpPKyJEk5GjbY16R3GNPGA1` is `READY` with a null Production target.
- Phase 7C3 is complete on `codex/phase-7c3-answer-bank-versions`; application commit `2b401b866d8cb90e491708de942d396b91e0e2be` is pushed and exact-source protected Git Preview `dpl_5g3Fv7hEVSjpQBCho4naDXhkz4pk` is `READY` with a null Production target.
- Phase 7C4 is complete on `codex/phase-7c4-answer-bank-decisions`; application commit `99d0acc4b1da5bd236effd6d0ec165d4e4e3929b` is pushed and exact-source protected Git Preview `dpl_23hthHcsTUk42up2B7jdS296U8ws` is `READY` with `target: preview`.
- Phase 7C5 is complete on `codex/phase-7c5-approved-bank-publishing`; application commit `a84bc22d521102f439feba1811b53b8061103857` is pushed and exact-source protected Git Preview `dpl_2KYohYZRwNfd94gi3MdZP4nuv9kY` is `READY` with a null Production target.
- Phase 7C6 is complete locally on `codex/phase-7c6-practice-supersession`; exact-source protected Preview verification is the remaining publication step.
- Non-production Supabase has twenty-one applied repository migrations, 418 canonical answers/801 aliases, thirty-two narrow gameplay/status/discovery/draft/review/bank/publishing RPC signatures plus one Realtime authorization helper, zero direct application-table grants, deny-all claim/catalog/draft/reviewer/bank/review/publishing/correction tables, empty reviewer/publisher allowlists and bank/review/publication/correction tables after QA, and private member-scoped per-player topics.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` (157 tests across 29 files), `pnpm build`, `pnpm audit:client-bundle`, and `git diff --check` pass. Existing direct hostile-client suites and the expanded category-bank correction/supersession hostile suite pass without printing local credential values.
- Elimination hostile checks prove one atomic owner under simultaneous submission, answer-free losers, retries, cross-room isolation, deadline behavior, direct-claim denial, unchanged private-race scoring, active secrecy, and completed ownership reveal.
- Local desktop/mobile and protected Phase 7A discovery QA passed without horizontal overflow or application/runtime errors. Phase 7B local QA additionally passes reviewed chemical selection, name/symbol/alternate acceptance, generic results/coverage, and spoiler-safe sharing; its protected Preview passes homepage/practice/discovery HTTP, exact-source, runtime-log, and Production-isolation gates. Phase 7C1 local QA passes the complete owner draft lifecycle. Phase 7C2 local QA passes ordinary-user denial and explicit reviewer queue/decision behavior. Phase 7C3 local QA passes bank open/validate/freeze/lock/correction. Phase 7C4 local QA passes the independent approval flow and its exact Preview passes protected page/API/runtime gates. Phase 7C5 local QA passes separate publishing authority, immutable release, discovery, dynamic practice, alias acceptance, accepted-concept fidelity, mobile action order, console, and overflow gates. Phase 7C6 local QA passes immutable release history, live-version preservation during correction, provenance-linked supersession, responsive fidelity, console, and overflow gates. Separate Phase 6 sessions previously passed the atomic elimination race/reveal gate.
- Security advisor findings remain the intentional deny-all/no-policy, narrowly granted RPC, member-constrained anonymous Realtime, and deferred password-account notices. Performance has only expected unused-index notices on the fresh schema. Preview-only environment variable names are unchanged; Production is untouched.

The next slice after Phase 7C6 publication is Phase 7C7: design bounded abuse reporting and moderation administration for reviewed discovery and published practice categories. Preserve immutable release provenance, the discovery/draft/reviewer/bank/publisher boundaries, trusted daily/room identity, server clock, deny-all direct-table posture, active answer secrecy, private Realtime topics, atomic elimination claims, and Preview-only deployment policy. Do not fabricate activity, expose reporters or private moderation notes, let ordinary anonymous users publish or overwrite history, treat reports as automatic takedowns, grant competitive eligibility implicitly, merge `main`, deploy Production, or configure CAPTCHA without explicit authorization and provider credentials.
