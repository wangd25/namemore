# Phase 8 retention policy

## Current state

Phase 8B adds a private, aggregate-only database dry run. It reports candidate counts but does not delete rows, schedule a job, expose identifiers, or grant browser execution. Production remains untouched.

Supabase currently applies a platform rate limit of 30 anonymous sign-ins per IP per hour. Vercel applies automatic DDoS mitigation to every deployment. The project has no custom Vercel Firewall rules and no pending firewall draft. The current plan does not expose the IP-bypass feature through the CLI, so an extra rate-limit rule is not being published before plan support, cost, traffic, and false-positive behavior are reviewed. Database action limits remain the final invariant backstop.

## Proposed periods

| Data | Dry-run predicate | Reason |
| --- | --- | --- |
| Expired active rooms | Deadline passed by more than 15 minutes | Finalize stale state after a grace period; do not delete it yet. |
| Waiting rooms | Created more than 24 hours ago | A room that never started is transient lobby data. |
| Completed or cancelled rooms | Ended more than 30 days ago | Keeps a short results window while limiting player and answer retention. |
| Anonymous action events | Occurred more than 24 hours ago | Matches the existing self-pruning abuse ledger. |
| Orphan anonymous users | Created more than 30 days ago and has no application reference | Follows Supabase guidance while protecting every known gameplay, draft, review, publication, moderation, and report reference. |

The anonymous-user predicate deliberately excludes anyone referenced by a daily attempt, room membership, action event, category draft, review role or decision, answer-bank edit or publication, correction request, moderation role or decision, or category report. This preserves leaderboard attempts and immutable category provenance.

## Approval gate before deletion

Before adding a cleanup function or schedule:

1. Run `private.retention_dry_run(statement_timestamp())` through an administrator-only SQL connection and save only the aggregate counts.
2. Verify that candidate counts match equivalent read-only SQL and that immutable category and daily-attempt counts are unchanged.
3. Take or confirm a usable non-production backup/restore point.
4. Implement bounded batches with a transaction-level advisory lock, an explicit maximum row count, and a post-run aggregate report.
5. Test rollback on non-production fixtures, then run the existing hostile-client and gameplay regression suites.
6. Require separate authorization before creating any Production schedule or applying the policy to Production data.

## Rollback and restore

The Phase 8B migration is reversible by dropping only `private.retention_dry_run(timestamptz)` in a new forward migration. Since this phase performs no deletion, data restoration is not required. A future destructive cleanup must document the backup identifier, restore procedure, bounded deletion order, expected cascades, and verification queries before it is scheduled.

## Firewall decision

Do not add application code that trusts arbitrary forwarded IP headers. Keep Supabase's anonymous-auth IP limit, Vercel's automatic DDoS mitigation, Preview Deployment Protection, and database identity-based limits enabled. Revisit a Preview-first Vercel WAF rate-limit rule only when the project plan supports it and real traffic establishes a threshold that will not interfere with rapid answer submission or shared-network players.
