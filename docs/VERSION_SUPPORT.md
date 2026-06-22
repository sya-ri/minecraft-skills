# Version Support

This file summarizes the checked-in Java Edition version coverage for minecraft-skills 0.1.0. It is
derived from the same catalog data used by the CLI, package API, and MCP server.

Use this page to decide whether an AI agent can safely target a Minecraft version before generating
datapacks, resourcepacks, or Paper plugins. A `yes` entry means minecraft-skills has a
machine-readable surface for that topic; it does not prove behavior beyond the surface described in
`docs/USAGE.md`.

## Summary

- Java release coverage: 1.13 through 26.2 (50 releases).
- Datapack coverage: server reports, command paths, vanilla datapack paths, and observed schema
  surfaces for 50/50 releases.
- Resourcepack coverage: vanilla asset paths and model summaries for 50/50 releases.
- Paper support metadata: 43 Minecraft versions, latest 1.21.11 build 69.
- Paper API package indexes: 43/43 supported Paper versions.
- Paper API type/member surfaces: 35/43 supported Paper versions.
- Downloadable heavy surfaces: datapack schema surfaces, Paper API surfaces, and resourcepack model
  summaries are listed in the data manifest and fetched into the runtime cache on demand.

## Aliases

| Alias | Version |
| --- | --- |
| latestJava | 26.2 |
| latestPaper | 1.21.11 |
| latestWithDatapackSchemaSurface | 26.2 |
| latestWithPaperApiSurface | 1.21.11 |
| latestWithResourcepackModels | 26.2 |

## Legend

- `Data PF` and `Resource PF` are extracted pack format numbers. Minor pack versions are shown as
  `major.minor` when Mojang exposes them.
- `Datapack` means server reports, command paths, vanilla datapack paths, and observed datapack JSON
  shape surface are available.
- `Resourcepack` means vanilla asset paths and resourcepack model summary are available.
- `Paper` means Paper marks that Minecraft version as supported and this project has Paper build/API
  reference metadata.
- `Paper API surface` means Javadocs type/member labels were extracted for that supported Paper
  version. Package indexes may still exist when this is `no`.
- `Heavy data` means at least one domain surface is downloadable via `minecraft-skills data fetch`;
  the npm package keeps large surfaces out of the tarball.

## Version Table

| Version | Released | Data PF | Resource PF | Datapack | Resourcepack | Paper | Paper build | Paper API surface | Heavy data | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 26.2 | 2026-06-16 | 107.1 | 88.0 | yes | yes | no | - | no | yes | Paper latest supported: 1.21.11 |
| 26.1.2 | 2026-04-09 | 101.1 | 84.0 | yes | yes | no | - | no | yes | Paper latest supported: 1.21.11 |
| 26.1.1 | 2026-04-01 | 101.1 | 84.0 | yes | yes | no | - | no | yes | Paper latest supported: 1.21.11 |
| 26.1 | 2026-03-24 | 101.1 | 84.0 | yes | yes | no | - | no | yes | Paper latest supported: 1.21.11 |
| 1.21.11 | 2025-12-09 | 94.1 | 75.0 | yes | yes | yes | 69 | yes | yes | - |
| 1.21.10 | 2025-10-07 | 88.0 | 69.0 | yes | yes | yes | 129 | yes | yes | - |
| 1.21.9 | 2025-09-30 | 88.0 | 69.0 | yes | yes | yes | 59 | yes | yes | - |
| 1.21.8 | 2025-07-17 | 81 | 64 | yes | yes | yes | 60 | yes | yes | - |
| 1.21.7 | 2025-06-30 | 81 | 64 | yes | yes | yes | 32 | yes | yes | - |
| 1.21.6 | 2025-06-17 | 80 | 63 | yes | yes | yes | 48 | yes | yes | - |
| 1.21.5 | 2025-03-25 | 71 | 55 | yes | yes | yes | 114 | yes | yes | - |
| 1.21.4 | 2024-12-03 | 61 | 46 | yes | yes | yes | 232 | yes | yes | - |
| 1.21.3 | 2024-10-23 | 57 | 42 | yes | yes | yes | 83 | yes | yes | - |
| 1.21.2 | 2024-10-22 | 57 | 42 | yes | yes | no | - | no | yes | Paper latest supported: 1.21.11 |
| 1.21.1 | 2024-08-08 | 48 | 34 | yes | yes | yes | 133 | yes | yes | - |
| 1.21 | 2024-06-13 | 48 | 34 | yes | yes | yes | 130 | no | yes | Paper type/member surface unavailable; package index only |
| 1.20.6 | 2024-04-29 | 41 | 32 | yes | yes | yes | 151 | yes | yes | - |
| 1.20.5 | 2024-04-23 | 41 | 32 | yes | yes | yes | 22 | yes | yes | - |
| 1.20.4 | 2023-12-07 | 26 | 22 | yes | yes | yes | 499 | yes | yes | - |
| 1.20.3 | 2023-12-04 | 26 | 22 | yes | yes | no | - | no | yes | Paper latest supported: 1.21.11 |
| 1.20.2 | 2023-09-20 | 18 | 18 | yes | yes | yes | 318 | yes | yes | - |
| 1.20.1 | 2023-06-12 | 15 | 15 | yes | yes | yes | 196 | yes | yes | - |
| 1.20 | 2023-06-02 | 15 | 15 | yes | yes | yes | 17 | no | yes | Paper type/member surface unavailable; package index only |
| 1.19.4 | 2023-03-14 | 12 | 13 | yes | yes | yes | 550 | yes | yes | - |
| 1.19.3 | 2022-12-07 | 10 | 12 | yes | yes | yes | 448 | yes | yes | - |
| 1.19.2 | 2022-08-05 | 10 | 9 | yes | yes | yes | 307 | yes | yes | - |
| 1.19.1 | 2022-07-27 | 10 | 9 | yes | yes | yes | 111 | yes | yes | - |
| 1.19 | 2022-06-07 | 10 | 9 | yes | yes | yes | 81 | no | yes | Paper type/member surface unavailable; package index only |
| 1.18.2 | 2022-02-28 | 9 | 8 | yes | yes | yes | 388 | yes | yes | - |
| 1.18.1 | 2021-12-10 | 8 | 8 | yes | yes | yes | 216 | yes | yes | - |
| 1.18 | 2021-11-30 | 8 | 8 | yes | yes | yes | 66 | no | yes | Paper type/member surface unavailable; package index only |
| 1.17.1 | 2021-07-06 | 7 | 7 | yes | yes | yes | 411 | yes | yes | - |
| 1.17 | 2021-06-08 | 7 | 7 | yes | yes | yes | 79 | no | yes | Paper type/member surface unavailable; package index only |
| 1.16.5 | 2021-01-14 | 6 | 6 | yes | yes | yes | 794 | yes | yes | - |
| 1.16.4 | 2020-10-29 | 6 | 6 | yes | yes | yes | 416 | yes | yes | - |
| 1.16.3 | 2020-09-10 | 6 | 6 | yes | yes | yes | 253 | yes | yes | - |
| 1.16.2 | 2020-08-11 | 6 | 6 | yes | yes | yes | 189 | yes | yes | - |
| 1.16.1 | 2020-06-24 | 5 | 5 | yes | yes | yes | 138 | yes | yes | - |
| 1.16 | 2020-06-23 | 5 | 5 | yes | yes | no | - | no | yes | Paper latest supported: 1.21.11 |
| 1.15.2 | 2020-01-17 | 5 | 5 | yes | yes | yes | 393 | yes | yes | - |
| 1.15.1 | 2019-12-16 | 5 | 5 | yes | yes | yes | 62 | yes | yes | - |
| 1.15 | 2019-12-09 | 5 | 5 | yes | yes | yes | 21 | no | yes | Paper type/member surface unavailable; package index only |
| 1.14.4 | 2019-07-19 | 4 | 4 | yes | yes | yes | 245 | yes | yes | - |
| 1.14.3 | 2019-06-24 | 4 | 4 | yes | yes | yes | 134 | yes | yes | - |
| 1.14.2 | 2019-05-27 | 4 | 4 | yes | yes | yes | 107 | yes | yes | - |
| 1.14.1 | 2019-05-13 | 4 | 4 | yes | yes | yes | 50 | yes | yes | - |
| 1.14 | 2019-04-23 | 4 | 4 | yes | yes | yes | 17 | no | yes | Paper type/member surface unavailable; package index only |
| 1.13.2 | 2018-10-22 | 4 | 4 | yes | yes | yes | 657 | yes | yes | - |
| 1.13.1 | 2018-08-22 | 4 | 4 | yes | yes | yes | 386 | yes | yes | - |
| 1.13 | 2018-07-18 | 4 | 4 | yes | yes | yes | 173 | no | yes | Paper type/member surface unavailable; package index only |
