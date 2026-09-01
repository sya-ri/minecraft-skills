# Optional Evaluation History

The evaluation-history feature provides a local feedback loop for improving minecraft-skills MCP
tools. When it is explicitly enabled, the MCP server stores each ordinary `tools/call` request and
response so that you can later describe the information you needed, score the result, record what
was missing, and group recurring gaps.

Evaluation history is **disabled by default**. It never uploads records, creates issues, expires
records, or deletes records automatically. The intended default use is private, local evaluation by
the minecraft-skills maintainer; contributors can opt in when they want to provide structured
feedback.

## Quick Start

Check the current global and project-specific state before enabling recording:

```sh
minecraft-skills evaluation status
minecraft-skills evaluation enable
```

Enabling the feature prints a privacy warning because the stored request and response are raw. After
enabling it, restart the MCP server so its instructions tell the agent how to evaluate tool results.

After using MCP tools, inspect and rate the resulting records:

```sh
minecraft-skills evaluation search
minecraft-skills evaluation show <id>
minecraft-skills evaluation rate <id> \
  --score 3 \
  --information-need "Determine which supported schema validates this data pack file" \
  --comment "The response identified the file kind but did not expose the required schema" \
  --missing-feature schema-details="Return the selected schema and unsupported fields"
minecraft-skills evaluation gaps
```

Use `npx minecraft-skills` in place of `minecraft-skills` when running the published package without
a global installation.

## What Is Recorded

One JSON record is stored for each completed ordinary MCP tool call while recording is effective.
The record contains:

- the exact MCP tool name and arguments;
- the exact MCP tool result, or a protocol error limited to its name and message;
- start and completion timestamps and duration;
- MCP, catalog-data, Node.js, operating-system, and CPU-architecture versions; and
- an optional evaluation added later by MCP or CLI.

Successful results, results with `isError: true`, thrown protocol errors, and cancelled calls are
represented by distinct outcomes. Evaluation-management calls are not recorded.

The feature does **not** record conversation messages, ordinary CLI commands, MCP resources, or MCP
prompts. The evaluator supplies `informationNeed` as a short, standalone description of what the
caller was trying to learn. This preserves useful context without copying the conversation into the
history.

## CLI Reference

| Command | Behavior |
| --- | --- |
| `evaluation status` | Show the global setting, effective setting for the current directory, blocking marker, storage path, and record count. |
| `evaluation enable` | Enable global recording after displaying the raw-data warning. Existing records are preserved. |
| `evaluation disable` | Disable global recording. Existing records are preserved. |
| `evaluation search [query]` | List newest matching summaries; filter by tool, evaluation state, score, missing-feature key, date, or result limit. |
| `evaluation show <id>` | Print the complete raw JSON record after displaying a privacy warning. |
| `evaluation rate <id>` | Add or replace the record's evaluation. |
| `evaluation gaps` | Group evaluated records by stable missing-feature key. |
| `evaluation delete <id...>` | Delete only the named records. |
| `evaluation delete --all --yes` | Delete all records and owned crash-residue record temp files with explicit confirmation. |

The complete search filter syntax is:

```text
evaluation search [query]
  [--tool <name>] [--evaluated <true|false>]
  [--min-score <1-5>] [--max-score <1-5>]
  [--missing-feature <key>] [--since <ISO timestamp>] [--until <ISO timestamp>]
  [--limit <1-100>]

evaluation gaps [query]
  [--tool <name>] [--min-score <1-5>] [--max-score <1-5>]
  [--missing-feature <key>] [--since <ISO timestamp>] [--until <ISO timestamp>]
```

`evaluation search` returns at most 20 records by default and accepts a limit up to 100. Its output
contains only record ID, timestamp, tool name, `mcpVersion`, `dataVersion`, score,
`informationNeed`, and missing-feature keys; it does not include raw request or response excerpts.
The free-text query also searches both recorded versions. `evaluation gaps` searches and returns all
matching aggregated gap metadata. Use `evaluation show` only when you are prepared to view
potentially sensitive raw data.

`evaluation rate` requires all of the following:

- `--score <1-5>`;
- `--information-need <text>`; and
- `--comment <text>`.

Repeat `--missing-feature <key>=<summary>` to record up to 20 missing capabilities. Keys must be
stable kebab-case identifiers so that semantically identical gaps aggregate together. Rating a
record that already has an evaluation replaces the previous evaluation.

Write `informationNeed` so it still makes sense when read without the original conversation. For
example, prefer “Determine which schema validates a Java 1.21.11 data pack recipe” over “Answer the
user's last question.” Put the reason for the score in `comment`, and put reusable capability names
in `missingFeatures`.

The scoring anchors are:

| Score | Meaning |
| --- | --- |
| 1 | Unusable for the stated information need. |
| 2 | Major information or capability is missing. |
| 3 | Partly useful, with a material gap. |
| 4 | Useful, with only a minor gap. |
| 5 | Fully meets the stated information need. |

`evaluation gaps` reports each missing-feature key's count, average score, affected tools, distinct
MCP and catalog data versions, first and last timestamps, and record IDs. Use stable keys across
evaluations; put record-specific detail in the summary or comment.

## MCP Evaluation Workflow

When recording succeeds, an ordinary tool result includes its record ID in the namespaced metadata
field `_meta["minecraft-skills/evaluationRecordId"]`. MCP clients may hide `_meta` from the model, so
the server also exposes these management tools:

| Tool | Input and purpose |
| --- | --- |
| `get_evaluation_status` | Takes `{}` and reports whether recording is effective and why, plus the current `runtime.mcpVersion` and `runtime.dataVersion`. |
| `list_pending_evaluations` | Takes optional `limit` from 1 to 100, default 20, and returns minimal summaries of the newest process-local unevaluated calls: ID, timestamps, tool, outcome, and that record's `runtime.mcpVersion` and `runtime.dataVersion`. |
| `record_tool_evaluation` | Takes `id`, `score`, `informationNeed`, `comment`, and optional `missingFeatures`; adds or replaces an evaluation. |

The three management tools are never recorded. `list_pending_evaluations` does not return raw
arguments or results; use the returned ID with the call already in the agent's context, or inspect
the complete local record explicitly with `evaluation show`. Pending-list and MCP rating calls are
unavailable while recording is ineffective in the current roots; the equivalent CLI operations
remain available for reviewing existing local history.

To bound memory in a long-running MCP process, the pending list tracks only the most recent 1,000
record IDs and reads them one at a time until it fills the requested limit. Older records remain on
disk and can still be found with `evaluation search --evaluated false`, shown, rated, or deleted
through the CLI.

At MCP server startup, evaluation instructions are added only when the global opt-in is enabled and
the process working directory is not blocked. Restart the server after `evaluation enable` so the
agent receives those instructions. The recording gate itself rereads configuration and project
markers for every ordinary tool call. A call must be eligible when it starts and still eligible when
it completes: enabling recording or removing a marker during a call does not retroactively capture
it, while disabling recording or adding a marker before completion prevents its capture.

## Local Project Opt-out

Create this marker anywhere in a project or one of its ancestor directories to disable recording
for that project, even when global recording is enabled:

```text
.minecraft-skills/evaluation.disabled
```

The marker can be any filesystem entry; its contents are ignored. Removing it makes the project
eligible for global recording again. It does not delete existing history and does not prevent CLI
search, show, rate, gaps, or delete operations.

When the MCP client advertises roots, the server requests the roots before each ordinary call and
checks every `file:` root and its ancestors. A marker under any one of those root paths disables
recording for that entire call. Non-file roots are ignored. If the client does not support roots or
the roots request fails, the server can only scan from the MCP process working directory upward.
Consequently, start the server from the project or configure MCP roots when relying on this opt-out.

This repository ignores its own marker. In another Git repository, keep the marker local by adding
`.minecraft-skills/evaluation.disabled` to `.git/info/exclude`, or commit it when recording should be
disabled for every contributor.

## Storage and Schema

The default storage root is `~/.minecraft-skills/evaluation`:

```text
~/.minecraft-skills/evaluation/
├── config.json
└── records/
    └── <uuid>.json
```

`config.json` contains `{ "schemaVersion": 1, "enabled": true|false }`. A missing, disabled,
malformed, or unsupported configuration fails closed and prevents recording. The storage directory
is not created merely by running with the default setting.

Each call is stored as one schema-versioned JSON document:

```json
{
  "schemaVersion": 1,
  "id": "uuid",
  "startedAt": "ISO-8601 timestamp",
  "completedAt": "ISO-8601 timestamp",
  "durationMs": 0,
  "runtime": {
    "mcpVersion": "package version",
    "dataVersion": "catalog data version",
    "nodeVersion": "version",
    "platform": "platform",
    "arch": "arch"
  },
  "request": {
    "method": "tools/call",
    "tool": "tool_name",
    "arguments": {}
  },
  "response": {
    "outcome": "success | tool-error | protocol-error | cancelled",
    "result": {},
    "error": {}
  },
  "evaluation": {
    "informationNeed": "Standalone description of the information that was needed",
    "score": 3,
    "comment": "Why the response received that score",
    "missingFeatures": [
      {
        "key": "stable-kebab-case-key",
        "summary": "Capability that would have improved the response"
      }
    ],
    "source": "mcp | cli",
    "evaluatedAt": "ISO-8601 timestamp"
  }
}
```

`evaluation` is absent until the call is rated. `informationNeed` is limited to 2,000 characters,
`comment` to 4,000 characters, and each missing-feature summary to 500 characters. A missing-feature
key is limited to 100 characters.

Records are written through same-directory temporary files and atomic replacement. Paths and UUIDs
are validated, symbolic-link records are not followed, and storage uses owner-only permissions
where the platform supports them (`0700` directories and `0600` files; best effort on Windows).
Storage failures never change the original MCP result and write only a payload-free diagnostic to
standard error. Bulk deletion also removes only temporary record files that match the evaluator's
strict internal filename pattern; unrelated hidden files are left untouched. Any deletion warning
causes a nonzero CLI exit status.

## Privacy and Retention

Raw arguments and results can contain local paths, logs, IP addresses, configuration values, player
or server data, and secrets supplied by a caller. No additional redaction or truncation is applied
before storage. Review MCP input before enabling the feature, use the project marker for sensitive
work, and disable recording when it is not needed.

Records remain on the local machine indefinitely until you explicitly delete selected IDs or run
`evaluation delete --all --yes`. Disabling recording or adding a marker does not remove history.
There is no background retention job, telemetry transport, automatic upload, or automatic issue
creation.

Storage has no quota. Ordinary MCP recording does not scan older records, so its work remains tied
to the current request and response size. `evaluation status` enumerates record filenames, while
`evaluation search` and `evaluation gaps` read every matching candidate file one at a time; their
elapsed time therefore grows with the record count and total stored bytes. Search retains at most
the requested 20-100 summaries in memory, and gap analysis retains only aggregates rather than raw
responses. A single unusually large raw request or response can still require substantial memory
while it is validated and serialized. For long-running opt-in use, check the record count and the
size of `~/.minecraft-skills/evaluation` periodically, then explicitly delete history that is no
longer needed.

## Sharing Useful Feedback

Contributors can turn local history into a focused GitHub issue without sharing the history file:

1. Run `evaluation search` and `evaluation gaps` to find a recurring or high-impact gap.
2. Run `evaluation show <id>` locally and review the complete record.
3. Manually remove credentials, tokens, personal data, private names, logs, IP addresses, paths,
   configuration values, and unrelated response content.
4. Copy `request.tool`, `runtime.mcpVersion`, and `runtime.dataVersion` from the selected record. The
   versions identify the exact minecraft-skills MCP code and catalog data that produced the result.
5. Open the **MCP evaluation feedback** Issue Form and copy those identifiers plus only the
   information need, score, evaluation comment, expected behavior, actual behavior,
   missing-feature summary, and the smallest sanitized excerpt needed to understand the gap.

Never attach or paste an unreviewed record. The repository does not provide an automatic upload path
by design.
