# NameMore

NameMore is a fast-paced, category-first recall platform where players try to name as many valid answers as possible before a timer expires. NBA players remain the first competitive proof of concept, while a reviewed Chemical Elements bank now proves that local practice, visuals, and results are not tied to sports. The current development branch extends category discovery into the first unrelated playable practice category without weakening the secure daily, private-race, or atomic elimination games.

## Current Status

Phases 1–6 and **Phase 7A: Category Discovery Foundation** are complete. **Phase 7B: Reviewed General Practice** is implemented and locally verified; Phase 7 remains in progress toward moderation and category lifecycle workflows.

**Current branch:** `codex/phase-7b-general-practice`, created from the completed Phase 7A branch. `main` has not been changed or merged.

The focused post–Phase 3 polish verifies that the non-production database has an active current-UTC challenge and a continuous schedule through 2026-12-31. A single transient empty status now triggers one automatic recovery check before the safe unavailable state appears. The ready dwell uses a damped charge and squash-and-stretch launch instead of a linear loading treatment, and competitive automatic answer checks begin after a 180ms pause instead of 420ms with a small in-board pending cue. No answer data or scoring authority moved into the browser.

Vercel CLI authentication is established as `wangd25`. GitHub repository `wangd25/namemore` is connected to Vercel project `namemore` (`prj_w1Py6yIeo5YUcGGpduA32VdgFeSH`) in team `namemore`, and `main` is the configured production branch. Preview deployment `dpl_678tmSyH761zXoqfTnfdqsRg9hLh` at `https://namemore-5t10gmiq8-namemore.vercel.app` was verified `Ready` with `target: preview`, returned HTTP 200 with the expected page, and passed the deployed smoke check. Production has zero deployments.

Phase 2 application preview `dpl_uriC84X7XFDHzAZE5Wqhhzm9Xc6f` at `https://namemore-io5cx2wo8-namemore.vercel.app` was verified `Ready`, `target: preview`, and sourced from the Phase 2 branch/application commit. The protected deployed flow passed start, accepted, duplicate, refresh/resume, finish, desktop/mobile layout, console, and error-log checks. Vercel Production still has zero deployments.

Phase 3 application commit `a169bc12ccf4e6eb386d9ff3c53181ca22b39b54` (`Build trusted daily leaderboard`) is pushed to `origin/codex/phase-3-daily-leaderboard-preview`. Git-integrated Preview `dpl_76HfnTfCiJzhXciMskCWkwzHi7ck` at `https://namemore-crpu1byy8-namemore.vercel.app` was verified `READY`, `target: preview`, and sourced from that exact commit. Its protected desktop/mobile flow passed name, start, accepted, duplicate, refresh/resume, finish, leaderboard/tie, console, overflow, and HTTP/runtime-log checks. Production still has zero deployments and no environment variables.

Focused polish application commit `49d1687c65e05a3d060983b39693363490ef134a` (`Polish daily readiness and answer latency`) is pushed to `origin/codex/daily-ready-spring-latency`. Protected Preview `dpl_AAN9cqyDdoSspYU1NYqikypwTEiD` at `https://namemore-kivmej10g-namemore.vercel.app` was verified `READY` from that exact commit. Its real daily flow loaded the active 2026-07-20 UTC challenge, started through the hover dwell, accepted and scored two names, finished with a verified leaderboard result, showed the pending answer cue at the 181ms debounce boundary, and had no browser warnings, horizontal overflow, runtime errors, or non-2xx application responses at 1440×1000 and 390×844. Production and `main` remain untouched.

Phase 4 application commit `84731004b12b151c22eff3b1e34a31ddbf3db3e8` (`Build secure private room lobby`) is pushed to `origin/codex/phase-4-secure-room-lobby`. Git-integrated protected Preview `dpl_9NjNPMpW3bshp43RPdQYWA6FRDCr` at `https://namemore-dtntgcegv-namemore.vercel.app` was verified `READY`, `target: preview`, and sourced from that exact commit. A fresh desktop host and 390px mobile guest created, joined, refreshed, synchronized, and host-started the same room with no browser errors, framework overlays, or horizontal overflow; deployment logs contained only 200/204 responses and no error/fatal entries. Production and `main` remain untouched.

Phase 5 application commit `cba8380e8b93d65383b9c0342aa6fc172b5e73c3` (`Build live private race multiplayer`) is pushed to `origin/codex/phase-5-live-private-race`. Git-integrated protected Preview `dpl_ADAE2bevosLdTLLMof3LKp478QvE` at `https://namemore-ri2n5f37t-namemore.vercel.app` was verified `READY`, `target: preview`, sourced from that exact commit, and passed protected homepage/room smoke checks with no runtime error logs. Separate in-app and Chrome sessions created, joined, synchronized, scored, preserved active-round answer secrecy, and revealed both verified answer lists after the server deadline. Production and `main` remain untouched.

Phase 6 application commit `1781efe1ca641d26f2607103b1b833d5ceb5d8ab` (`Build atomic elimination mode`) is pushed to `origin/codex/phase-6-atomic-elimination`. Git-integrated protected Preview `dpl_GDCbaEUg19nSxAGdKBPKzkPfg6HU` at `https://namemore-l33tucael-namemore.vercel.app` was verified `READY`, `target: preview`, and sourced from that exact commit. Protected homepage, room, and current-daily status checks returned HTTP 200; the 2026-07-20 UTC challenge was available; runtime error and 5xx scans were empty. Separate in-app and Chrome sessions proved exactly one winner for a simultaneous claim, answer-free `already-taken` feedback, independent later claims, active answer secrecy, and verified ownership reveal. Production and `main` remain untouched.

Phase 7A moves the trusted daily game to `/daily` and makes `/` an accessible editable category combobox. Its debounced no-store discovery endpoint returns only curated catalog entries, versioned answer-bank status, and real aggregate cards. The current NBA category is the only playable reviewed entry; Countries in Europe and Chemical elements are honestly labeled as answer banks still in review. `/category/new` saves bounded private drafts containing prompt, provenance, and coverage notes; database constraints force them to remain unreviewed, practice-only, and competitively ineligible. No draft text enters public recommendations.

Phase 7A application commit `5db1edf90674a484daa74fb6a02e6328874d2c3f` (`Build category discovery foundation`) is pushed to `origin/codex/phase-7-category-discovery`. Exact-source protected Preview `dpl_J7QnKCxwXBEL3Z44FEWnLwvVxaam` at `https://namemore-3bs4tw16l-namemore.vercel.app` was verified `READY` with `target: preview`. Its protected mobile discovery/search/draft/daily flow returned the real catalog and aggregate data, blocked in-review play, preserved the trusted daily entry, had no horizontal overflow, and produced no runtime error/fatal logs. Production has zero deployments; `main` remains untouched.

Phase 7B adds a manually reviewed 118-element IUPAC snapshot, symbol aliases, four documented regional/historical aliases, period coverage metadata, and a static `/practice/chemical-elements` route. Category visuals, input copy, source labels, coverage summaries, results, and spoiler-safe sharing are now data-driven; NBA team metadata remains an optional adapter for the existing daily and room games. The discovery catalog exposes Chemical Elements as reviewed local practice while keeping Countries in Europe honestly in review and all custom drafts noncompetitive. Local desktop/mobile browser QA passes the full chemical play/results flow without NBA copy, console errors, or horizontal overflow. Publication and protected Preview verification are still pending.

Supabase project `namemore` (`hutmxxlicxeaovoeqbwg`) was explicitly confirmed non-production. Anonymous sign-in is enabled. Fourteen repository migrations now provide 418 private canonical answers and 801 aliases across the immutable NBA and Chemical Elements versions, a UTC schedule through 2026-12-31, deny-all RLS daily/room/submission/claim/discovery/draft tables, immutable display names, strict control-character rejection, answer-check and draft-creation burst controls, private per-player Realtime topics, fourteen narrow gameplay/status/discovery RPC signatures plus one Realtime authorization helper. Vercel contains only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, scoped to Preview; Production variables were not changed.

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
- Detailed local results with score, local best, answers per minute, acceptance timeline, fastest gap, longest pause, duplicate count, and optional category coverage such as represented/missed NBA teams or element periods.
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
- A `/room` entry and `/room/[roomCode]` liquid-glass lobby for private races, with eight-character non-ambiguous invite codes, real participant rows, eight visible capacity slots, copyable invite URLs, safe refresh recovery, stale-participant display, and host-only start controls.
- Database-authoritative room creation, status, join/rejoin, and start operations. Membership is unique per room/user, capacity races lock at eight, display names are immutable membership data, outsiders receive category/status/count but no participant names, late joins are denied, and the database owns start/deadline timestamps.
- Live private-race gameplay with a server clock, server-normalized answer submissions, per-player canonical uniqueness, verified scores, bounded answer checks, automatic deadline completion, and post-round reveal.
- Private per-player Supabase Realtime channels use Presence only for connectivity and Broadcast only for coarse typing state and empty board-change notifications. Active opponents receive counts and synthetic bars but never answer text; the receiver derives player identity from the authorized channel topic instead of trusting payload identity.
- Equal liquid-glass player boards at desktop and stacked mobile sizes, local wet-ink answers, restrained score motion, reconnect fallback, tie-aware verified results, replay, and reduced-motion-safe behavior.
- An accessible private-race/elimination mode picker, explicit first-claim feedback, and claim-specific result language while preserving private race as the default.
- Database-atomic elimination ownership through a unique `(room_id, answer_id)` claim key. Concurrent losers receive an answer-free `already-taken` response; claims remain hidden during play and reveal only through the existing completed-room projection.
- A category-first homepage with a multiline editable ARIA combobox, 180ms server search, keyboard/touch selection, explicit reviewed/in-review states, and a trusted `/daily` handoff. In-review prompts cannot start a round.
- A reviewed Chemical Elements local-practice route containing all 118 IUPAC element names in atomic-number order, symbol aliases, documented alternate spellings/names, and seven period coverage groups. It is explicitly unranked and noncompetitive.
- Category-neutral practice contracts for input labels, placeholders, source notes, compact answer visuals, coverage groups, result summaries, timelines, and spoiler-free sharing. NBA colors, marks, and team coverage are optional category metadata rather than universal fields.
- Sparse liquid-glass activity cards backed only by the verified current-daily best, a minimum-three-round popularity aggregate, and recent waiting/active room counts. Missing metrics disappear rather than falling back to fabricated values.
- A separate `/category/new` practice-draft workspace and bounded no-store API. Private deny-all storage records prompt, provenance, and coverage boundaries; ownership, hourly limits, control-character rejection, and permanent unreviewed/noncompetitive state are database-enforced.
- A deterministic 300-answer/561-alias seed plus 168 scheduled UTC challenge dates from 2026-07-17 through 2026-12-31.
- One hundred ten passing unit, dataset, contract, session, request-boundary, migration, Realtime, and component tests across twenty test files, plus direct publishable-key daily, room-lobby, room-game, and elimination hostile-client scripts.

Not implemented yet:

- Global aggregates or production launch hardening.
- CAPTCHA. A broader unprotected preview requires a product choice and credentials for hCaptcha or Cloudflare Turnstile; the current preview remains protected by Vercel team authentication.
- Public category correction/moderation workflows, draft editing/review/publishing, provenance administration, and broader discovery abuse reporting.

## Product Direction Beyond NBA

The homepage question is now the product's category composer. A player can edit the large prompt, search the curated catalog, select the trusted NBA daily, play the reviewed Chemical Elements practice category, or enter a separate private draft flow. Countries in Europe remains unavailable until its bank is reviewed rather than being presented as exhaustive prematurely.

The surrounding ready screen now carries a sparse atmospheric layer of slowly drifting liquid-glass cards for real verified highs, minimum-sample popularity, and recent room activity. They remain secondary to the prompt, stop for reduced motion, collapse to one card on mobile, and disappear when trusted data is absent.

Universal category and answer contracts now treat compact visuals and coverage groups as optional category-provided metadata. NBA team marks/colors and chemical symbols/periods use the same renderer without making either subject a universal requirement.

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

Verification snapshot from 2026-07-20 UTC:

- `git diff --check`, `pnpm lint`, `pnpm typecheck`, and the Next.js production build pass.
- `pnpm test` passes 110 tests in 20 test files.
- The hostile-client script passes directly against Supabase using only the public URL/publishable key and anonymous identities. It additionally proves display-name validation/normalization/immutability, active-attempt exclusion, top-ten limiting, deterministic tie order, safe projection keys, no UUID/answer leakage, direct leaderboard insertion denial, concurrent idempotent finish, and the 40-per-10-second burst guard.
- A rollback-only live database deadline test returned `round-ended` and `expired` without accepting a late answer. Migration history, 418 answers, 801 aliases, 168 scheduled challenges through 2026-12-31, RLS, grants, constraints, and indexes were inspected live. The Chemical Elements version has exactly 118 canonical answers and 240 accepted exact/symbol/alternate aliases, no team codes, and direct public-table reads remain denied.
- Supabase security advisors report only intentional deny-all/no-policy tables, the intentionally callable authenticated security-definer operations, anonymous Realtime access constrained by membership policies, and leaked-password protection for the deferred permanent-account path. Performance advisors report only expected unused indexes on the fresh schema; all reported missing foreign-key indexes were fixed.
- The room hostile-client suite uses isolated anonymous sessions to prove safe outsider projection, stable rejoin, immutable membership names, direct table/status/deadline denial, non-host start denial, an atomic eight-player capacity race, host-set 90-second timestamps, and late-join rejection. The room host foreign-key advisor issue was fixed forward-only; remaining room index notices are expected on fresh QA data.
- The room-game hostile-client suite proves unsigned/outsider/direct-table denial, independent per-player scoring for the same canonical answer, duplicate and invalid handling, active opponent-answer secrecy, private topic membership, own-topic-only publish rights, safe Presence/Broadcast payloads, automatic deadline completion, and post-round reveal.
- The elimination hostile-client suite proves unsigned and direct-claim denial, exactly one owner under simultaneous submissions, idempotent winner retry, answer-free loser responses, cross-room isolation, unchanged private-race scoring, late-answer rejection, and verified ownership reveal.
- `pnpm audit:client-bundle` audits the page’s manifest-referenced browser chunks and finds no NBA answer-bank markers. HTML inspection also found no canonical answer leakage before acceptance.
- Local and protected deployed browser QA at 1440×1000 and 390×844 completed the real Next.js/Supabase flow: malicious-name rejection, normalized name, named start, accepted answer, duplicate without score change, refresh/resume at the original deadline, finish, leaderboard, forced local offline/error and retry recovery, deterministic ties, HTTP 200/204 route responses, no application or runtime errors, no answer-bank leakage, and no horizontal overflow.
- Phase 7A local and protected Preview QA loaded the three-entry curated catalog and real 11-name/23-round/2-room aggregate snapshot, filtered `chem` through the debounced endpoint, blocked the in-review category from play, opened the separate draft workspace, preserved `/daily`, produced no application or runtime errors, and had no horizontal overflow at 1440×1000 and 390×844.
- Phase 7B local QA selected the now-reviewed Chemical Elements entry, accepted full names, symbols, and the `Aluminum` alias, rendered symbol tiles and period coverage, produced category-neutral results/share text, and had no application console errors or horizontal overflow at 1440×1000 and 390×844.

## Roadmap Remaining

Phases 1–6 are complete. **Phase 7 is in progress**; moderation, draft review/publishing, corrections/versioning, and abuse reporting remain before Phase 8 production hardening/launch.

In Codex desktop, the shell may not include `node` on its default `PATH`. Use the bundled workspace Node runtime when that occurs; do not treat a missing shell executable as an application failure.

## Current Project Structure

```text
app/
  api/categories/        No-store curated discovery and private-draft Route Handlers
  api/daily/             No-store status/named-start/submit/finish/leaderboard Route Handlers
  api/rooms/             No-store create/status/join/start/game/submit Route Handlers
  category/new/          Separate private practice-draft workspace
  daily/                 Trusted server-authoritative daily route
  practice/[slug]/       Static reviewed local-practice categories
  room/                  Private-room entry, lobby, live game, and results routes
  globals.css            White liquid-glass, clean answer-surface, ripple, and responsive rules
  layout.tsx             Root layout and NameMore metadata
  page.tsx               Server-rendered NameMore homepage shell
components/
  CategoryDiscovery.tsx  Editable catalog combobox and real ambient activity cards
  CategoryDraftForm.tsx  Bounded private provenance/coverage draft form
  DailyGameBoard.tsx     Narrow server-authoritative timer/input Client Component
  DailyGameResults.tsx   Verified accepted-answer timeline and team coverage
  DailyLeaderboard.tsx   Safe top-ten loading/empty/error/tie projection
  GameBoard.tsx          Ready dwell, clean answer field, delight feedback, timer, and local state
  GameResults.tsx        Detailed local timeline, metrics, coverage, sharing, and replay UI
  RoomEntry.tsx          Create/join private-room entry surface
  RoomLobby.tsx          Safe participant lobby, invite, refresh, and game handoff
  RoomGame.tsx           Live server-authoritative private-race boards and input
  RoomResults.tsx        Verified ranks and deadline-gated answer reveal
lib/
  category-discovery-*   Safe discovery/draft types, contracts, routes, and RPC service
  categories.ts          Versioned 300-player NBA dataset and category adapter
  chemical-elements.ts   Reviewed 118-element IUPAC local-practice dataset
  category-types.ts      Category and submission domain types
  daily-*.ts             Safe contracts, browser API, Route helpers, and trusted RPC service
  room-*.ts              Safe room contracts, browser API, Route helpers, and trusted RPC service
  supabase/              SSR config, request client, anonymous session, and Proxy refresh
  game-logic.ts          Matching and canonical submission evaluation
  normalize.ts           Deterministic answer normalization helpers
  practice-game.ts       Local result metrics, storage, optional coverage, and share helpers
scripts/
  audit-client-bundle.mjs      Manifest-scoped answer-bank leak audit
  hostile-client-check.mjs     Direct public-key daily authorization/concurrency checks
  room-hostile-client-check.mjs Direct public-key room authorization/capacity checks
  room-game-hostile-client-check.mjs Direct live-game/Realtime/privacy checks
  elimination-hostile-client-check.mjs Direct atomic-claim/concurrency/regression checks
supabase/
  config.toml             Anonymous-auth local configuration
  migrations/             Schema/seed, schedule, RPC correction, and index migrations
AGENTS.md                 Repository-wide product, security, and coding rules
plan.md                   Eight-phase implementation plan and live status
```

There is no permanent account, general analytics dashboard, CAPTCHA integration, or production deployment.

## Security Boundary

Competitive answer banks remain private database data and are absent from competitive browser JavaScript, HTML, RSC payloads, and public API responses. The reviewed Chemical Elements bank is intentionally shipped to the browser only on its explicitly unranked local-practice route. Anonymous users receive the `authenticated` role, but direct application-table access remains denied by explicit grants and RLS; only narrow ownership-checking operations are executable. During a live room, members receive safe counts and per-player private Realtime activity while opponent answer arrays remain absent; complete answer lists are projected only after the server deadline. The leaderboard exposes no UUIDs, answers, guesses, auth metadata, attempt IDs, or ordering timestamps, and outsider room status exposes no participant identities. Browser-visible configuration contains only the Supabase project URL and publishable key. Never introduce a service-role key into this application path or weaken the deny-by-default boundary.

The live multiplayer presentation uses equal player and opponent liquid-glass boards. Opponent typing looks live through synthetic blurred placeholders based only on safe typing status and a coarse length bucket. Raw opponent letters or answers are never sent to another player during an active round.
