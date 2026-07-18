# NameMore Implementation Plan

## Current Findings

- As of 2026-07-18 UTC, Phase 2 is complete. It passed local/non-production Supabase, direct hostile-client, advisor, bundle-leak, GitHub publication, and local/deployed desktop/mobile browser gates.
- `codex/phase-2-server-authoritative-daily` adds cookie-backed Supabase anonymous sessions, Next.js 16 Proxy/session refresh, four thin daily Route Handlers, runtime-validated safe contracts, and a narrow daily game Client Component that never imports the answer bank.
- Non-production Supabase project `namemore` (`hutmxxlicxeaovoeqbwg`) has anonymous sign-in enabled and four applied repository-owned migrations: the private category/alias schema and deterministic seed; a 30-day UTC schedule through 2026-08-16; corrected RPC time variables; and covering foreign-key indexes.
- The database contains 300 canonical answers and 561 normalized aliases in the unexposed `private` schema. All six tables have RLS enabled and no permissive browser policies. Direct table privileges are revoked; exactly four `authenticated` security-definer RPCs have a safe empty search path and enforce `auth.uid()`, ownership, deadlines, atomic uniqueness, and derived scores.
- Vercel project `namemore` contains only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, scoped to Preview. No Production variables or deployments were changed.
- `pnpm test` passes 58 tests across 10 files. `pnpm test:hostile-client`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm audit:client-bundle`, and `git diff --check` pass. Live browser QA covered start, accepted, duplicate, refresh/resume, finish, verified results, console state, payload leakage, and overflow at 1440×1000 and 390×844.
- As of 2026-07-17, the Phase 1 implementation and local checks are complete. The 34-path publication scope was re-audited successfully, committed as `09fcb0d3b412bbb9d289dfc3a579f4fe3325a696` on `codex/phase-1-whiteboard-preview`, and pushed to `origin`.
- The homepage renders the responsive NameMore local practice game with `ready`, `playing`, `ending`, and `finished` states, an absolute-deadline timer, hover/focus/press-and-hold readiness, continuous typing with automatic exact/alias acceptance, keyboard fallback submission, feedback, scoring, accepted answers, manual finish, and replay.
- NameMore's target product is category-first. NBA players are the current manually curated vertical slice; the future ready-state headline becomes an editable prompt composer with reviewed-category recommendations and a distinct custom-category creation path. This direction is documented but not implemented or authorized before the Phase 1 publication gate.
- The future ready screen may include a sparse ambient layer of slowly drifting liquid-glass cards for real popular prompts, verified high scores, active public lobbies, or tiny aggregate trend traces. These cards remain secondary, reduced-motion-safe, mobile-aware, and absent when trusted aggregate data is unavailable; fabricated activity is prohibited.
- The interface uses the Apple system font stack on a true-white, prediction-market-inspired canvas. One nearly full-viewport translucent liquid-glass board contains a compact timer/score HUD and a clean unruled whiteboard with borderless in-board typing. Pointer-origin liquid ripples react on the ready and writing surfaces without per-movement React renders.
- The completed local delight pass adds wet-ink answer settling, a board-wide milestone wave every five answers, duplicate-line highlighting, optional failure-safe sound/haptics with a slightly louder two-note accepted-answer chime, a versioned local-practice best, final-ten-second tension, a graceful ending freeze, detailed local results, and explicitly activated spoiler-safe sharing.
- The current playing surface is near full-bleed, with a restrained transform-free 90ms typing response and a spring-check/stronger-team-color-wash acceptance treatment. Reusable answer icon slots sit directly beside names and currently render compact NBA team marks. Two answers within 2.5 seconds trigger a board-wide green liquid ripple and a temporary notification with measured timing and tiered natural copy. Prefix-conflicting matches wait 420ms before automatic acceptance so a longer valid name can be completed. The pointer effect is a compact 46px desktop/36px mobile lens that follows mouse position without looping or appearing solely from keyboard focus.
- Local results calculate only available practice data: score, local best, answers per minute, acceptance timeline, shortest accepted-answer gap, longest pause, duplicate attempts, and represented/missed NBA teams. Global averages, percentiles, rarity, and other-user statistics remain deferred until trusted server data exists.
- `lib/categories.ts` contains a versioned 2026-07-15 NBA snapshot with 30 teams, 10 players per team, and 300 canonical answers.
- `lib/normalize.ts` and `lib/game-logic.ts` implement deterministic normalization, canonical lookup construction, explicit aliases, unique-surname aliases, and collision detection.
- Vitest and React Testing Library run 58 passing unit, dataset, component, contract, request-boundary, session, and migration tests across 10 test files.
- There is no leaderboard, display-name flow, room route, Realtime feature, permanent account, or production deployment.
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
| 3. Daily leaderboard and preview release | **Not started** | Verified leaderboard, daily UX, E2E coverage, and preview deployment verification. |
| 4. Secure private room lobby | **Not started** | Room/player schema, create/join/rejoin/start flows, UI, and authorization tests. |
| 5. Live private-race multiplayer | **Not started** | Safe Realtime state, private submissions, reconnect behavior, and post-round reveal. |
| 6. Atomic elimination mode | **Not started** | Transactional answer claims, already-taken feedback, and concurrency tests. |
| 7. General category studio and discovery | **Not started** | Category-agnostic contracts, editable prompt recommendations, moderated custom-category drafts, and real aggregate discovery cards. |
| 8. Production hardening and launch | **Not started** | Abuse controls, retention, full reviews, release verification, and production smoke tests. |

**Phase count:** Phases 1 and 2 are complete, and 6 later implementation phases remain.

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

This is the currently implemented Phase 1 union. The `already-taken` result is intentionally deferred until Phase 6 introduces elimination mode.

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

**Status: Not started.** Depends on Phase 2's trusted attempt and scoring path.

- Add a safe leaderboard projection/table populated only by the trusted finish path; expose only challenge, display name, verified score, and ordering timestamps.
- Build the display-name entry, daily status/resume experience, final submission state, top-ten leaderboard, loading/empty/error states, and safe retry behavior.
- Add one-attempt messaging, UTC reset copy, category version preservation, and corrections through new versions rather than historical mutation.
- Establish the trusted data needed for later daily retention features: streak/archive history, personal score history, global average/percentile, answer rarity, and most-missed-answer summaries. Ship only metrics whose privacy, minimum-sample, moderation, and versioning rules are documented and tested.
- Add core daily Playwright coverage once the flow is stable, then verify migrations, RLS, security/performance advisors, GitHub diff, Vercel environment names, preview deployment, and end-to-end smoke tests.
- Gate: a deployed preview completes the anonymous daily flow without exposing the answer bank or accepting browser-forged state.

## Phase 4 — Secure Private Room Lobby

**Status: Not started.** Depends on a stable deployed daily architecture and anonymous identity.

- Add rooms and players with internal UUIDs, public room codes, `waiting/active/completed/cancelled` states, mode allowlisting, host player linkage, and a unique room/user membership.
- Implement create, join, rejoin, and host-only start as atomic server/database operations. The database sets start/deadline timestamps; room capacity is eight; late joins are denied.
- Build `/room/[roomId]` lobby UI, shareable URL handling, participant list, host controls, refresh recovery, and safe disconnected-player display.
- Test unguessable identity, room-code validation, capacity races, duplicate joins, non-host start attempts, cross-room access, and direct status/deadline writes.
- Gate: two anonymous browser sessions can create/join/rejoin a room, and only the host can start it.

## Phase 5 — Live Private-Race Multiplayer

**Status: Not started.** Depends on the secure room lobby and authorization model from Phase 4.

- Add per-player accepted submissions and safe player-state counts. A canonical answer may score once per player in private-race mode.
- Use Supabase Presence for connectivity, authorized Broadcast for typing state, and database changes only for persistent room/player state. Typing payloads contain player ID, boolean typing state, and a coarse length bucket—never answer text.
- Render the local player's accepted answers and synthetic opponent bars/counts. Active-round RLS and result RPCs prevent opponent answer retrieval through REST, Realtime, HTML, or serialized React state.
- Apply the planned equal-board multiplayer direction with safe synthetic blurred typing indicators, restrained score pulses and lead-change motion, and live-showdown framing. Typing signals remain limited to status and a coarse length bucket.
- Finish/reveal results only after the server deadline. Test simultaneous play, reconnects, stale events, cleanup, deadline agreement, network payload privacy, and unauthorized channel access.
- Gate: multiple browsers complete a private race with synchronized safe state and verified post-round reveal.

## Phase 6 — Atomic Elimination Mode

**Status: Not started.** Depends on the working private-race multiplayer path from Phase 5.

- Extend the room mode union with `elimination` while preserving `private_race` as default.
- Implement a transactional claim path with a unique `(room_id, category_answer_id)` invariant. The first valid claim scores; concurrent losers receive `already-taken` without leaking the owner's answer during the round.
- Add elimination-specific feedback and final ownership results without changing private-race behavior.
- Test true concurrent submissions, retries/idempotency, cross-room isolation, deadline races, disconnects, and mode regression coverage.
- Gate: database concurrency tests prove exactly one owner per canonical answer per room.

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

- Phase 1 is complete and its documentation closeout is pushed. `main` remains untouched.
- Phase 2 is implemented on `codex/phase-2-server-authoritative-daily`. The non-production Supabase project has four applied repository migrations and persisted anonymous-auth configuration.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` (58 tests across 10 files), `pnpm test:hostile-client`, `pnpm build`, `pnpm audit:client-bundle`, and `git diff --check` pass.
- Direct public-key and rollback-only database tests prove ownership, direct-access denial, hidden answers, unique attempts/submissions, deadline rejection, derived score, concurrent duplicates, and idempotent finish.
- Desktop/mobile real-backend QA passed at 1440×1000 and 390×844 without application errors, answer-bank leakage, or horizontal overflow. The flow covered start, acceptance, duplicate, refresh/resume, finish, verified results, and safe HTTP 200 route responses.
- Supabase security advisor findings are intentional deny-all/no-policy and narrowly granted RPC notices; performance has only expected unused-index notices on the fresh schema. Preview-only public environment variable names are configured in Vercel; Production was not changed.

Phase 2 is complete. The next authorized milestone would be Phase 3’s privacy-reviewed leaderboard projection, display-name flow, abuse controls for a broader preview, extended challenge schedule, and deployed E2E gate. Do not begin Phase 3, merge `main`, or deploy Production without separate authorization.
