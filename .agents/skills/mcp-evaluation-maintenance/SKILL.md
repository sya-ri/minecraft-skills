---
name: mcp-evaluation-maintenance
description: Review local minecraft-skills MCP evaluation history within a bounded time window, choose a reproducible in-scope gap, implement and verify a fix, and prepare a focused pull request. Use for recent evaluation audits or when turning recurring evaluation gaps into repository changes; do not use to delete, upload, or broadly expose raw evaluation records.
---

# MCP Evaluation Maintenance

Turn a bounded slice of local minecraft-skills MCP evaluation history into one evidence-backed
repository improvement.

## Establish the Window Safely

1. Call `get_evaluation_status` and `list_pending_evaluations` before reading completed history.
   These management calls are not recorded. Report the effective setting, MCP/data versions,
   warnings, and pending count. Do not enable, disable, rate, or delete records unless the task calls
   for that mutation.
2. For change work, build the local CLI so the helper uses the checked-out code:

   ```sh
   mise exec -- pnpm build
   ```

   For a strictly read-only audit, do not build. Use an already present trusted build only when it
   corresponds to the checkout; otherwise use the MCP management views directly or report that a
   build is required before the helper can run. Do not describe an audit as read-only after writing
   build output.

3. Run the read-only report with a bounded period and explicit timezones:

   ```sh
   mise exec -- pnpm run evaluation:window -- scan \
     --since 2026-09-01T00:00:00.000Z \
     --until 2026-09-02T00:00:00.000Z
   ```

   `--since` and `--until` are inclusive and apply to `completedAt`. To continue exactly after a
   prior report, use its `window.nextSince`, which is the latest returned completion time plus one
   millisecond. Optional `--tool`, `--missing-feature`, and `--query` filters match the evaluation
   CLI. The helper derives gaps from that one search result so concurrent store updates cannot mix
   two snapshots. Output is restricted to allowlisted non-narrative fields from the CLI's safe
   summaries. It intentionally omits the free-form `informationNeed` and query text; retrieve only
   the selected record's safe summary locally and sanitize that text before using it in a report or
   PR.

4. Stop and split the period when `complete` is false. The CLI has no cursor and returns at most 100
   summaries; the helper exits with status 2 rather than silently treating a limit-sized or warned
   result as complete. Deduplicate record IDs if intentionally using overlapping boundaries.

Do not run `evaluation show` by default. It exposes raw arguments and responses that may contain
credentials, private names, logs, IP addresses, or local paths. If a safe summary is insufficient,
explain why raw inspection is needed before opening one record, keep the inspection local, and never
commit, upload, or send an unsanitized record to a subagent.

The helper itself invokes only `evaluation search`; it does not create or rate records. In a shared
evaluation store, unrelated concurrent MCP calls can still change the global record count, so do
not use count changes alone to attribute a mutation to the helper.

## Choose a Candidate

Treat history as evidence about an earlier runtime, not current truth. Before selecting a gap:

- check whether a newer MCP/data version, merged PR, open PR, or upstream deployment already fixes
  it;
- group semantically equivalent keys manually when evaluators used different wording;
- prefer low scores, repeated records, multiple affected tools, and a small reproducible case;
- confirm the capability belongs in minecraft-skills rather than the caller's project or a
  third-party service; and
- require an allowed canonical or structured source for Minecraft facts.

`rankedGaps` is deterministic: lower average score first, then higher occurrence count, broader tool
impact, and recency. It is a triage aid, not an automatic product decision. Also inspect
`lowScoreRecordsWithoutGaps`; a poor result may have been rated without a reusable gap key.

## Reproduce and Fix

1. Retain the selected tool, sanitized information need, MCP/data versions, score, and stable gap
   keys. Record IDs are local correlation values and normally do not belong in a public PR.
2. Reproduce the smallest safe behavior against the recorded version when practical, then against
   current `main`. Never replay raw arguments blindly: an MCP tool may read, write, fetch, or contact
   a service. If the task requires evaluation-history invariance, use a local CLI or fixture-based
   reproduction instead of an ordinary recording-enabled MCP call. A failure that no longer
   reproduces needs a verification note, not another fix.
3. Rate each ordinary minecraft-skills MCP call immediately using that call's visible evaluation
   receipt. Use `list_pending_evaluations` only when the ID is unambiguous; never guess among
   same-tool pending records.
4. Search existing issues, PRs, branches, and upstream state before editing. Split independent
   upstream and minecraft-skills changes into separate PRs when either can land alone.
5. Start from current `main`, read repository instructions and recent commit style, and create a
   focused branch. Keep `codex` out of branch names and PR titles.
6. Add a regression test that expresses the information need, then implement the narrowest reusable
   capability. Preserve source provenance, coverage, bounds, and non-guarantees. If generated
   version data changes, follow `minecraft-version-maintenance` and never hand-edit generated JSON.

If the fix depends on an unavailable upstream release, authentication, or a product choice that
materially changes scope, stop after documenting the reproducible blocker or open a separate
authorized upstream change. Do not hide the gap with guessed fallback data.

## Verify and Close the Loop

Run focused tests first, then the repository checks appropriate to the change. Version-data changes
require the complete verification sequence from `minecraft-version-maintenance`. Before committing,
always run `git diff --check` and confirm only intentional files are present.

Re-run the original information need on an MCP process that actually loads the updated build, rate
the new call independently, then compare only safe summaries:

```sh
mise exec -- pnpm run evaluation:window -- compare \
  --before <historical-record-id> \
  --after <updated-record-id>
```

The comparison reports score and gap-key changes but never declares a fix automatically. Passing
unit tests alone is code-level verification; do not call it a post-fix MCP evaluation. Do not rewrite
the historical rating to make it look successful.

The PR summary should map each selected gap key to its regression test and implementation, state the
source and coverage limits, list verification commands, and distinguish code verification from any
post-fix MCP evaluation. Share only sanitized evidence.
