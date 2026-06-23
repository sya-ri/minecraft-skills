# Version Support

This file summarizes the checked-in Java Edition version coverage for minecraft-skills 0.1.2. It is
derived from the same catalog data used by the CLI, package API, and MCP server.

Use this page to decide whether an AI agent can safely target a Minecraft version before generating
datapacks, resourcepacks, or Paper plugins. A `✅` entry means minecraft-skills has a
machine-readable surface for that topic; a blank cell means the surface is not available for that
version. It does not prove behavior beyond the surface described in `docs/USAGE.md`.

## Summary

- Java release coverage: 1.13 through 26.2 (50 releases).
- Datapack coverage: server reports, command paths, vanilla datapack paths, and observed schema
  surfaces for 50/50 releases.
- Resourcepack coverage: vanilla asset paths and model summaries for 50/50 releases.
- Paper support metadata: 46 Minecraft versions, latest 26.2 build 30.
- Paper API package indexes: 46/46 supported Paper versions.
- Paper API type/member surfaces: 38/46 supported Paper versions.
- Downloadable heavy surfaces: datapack schema surfaces, Paper API surfaces, and resourcepack model
  summaries are listed in the data manifest and fetched into the runtime cache on demand.

## Aliases

| Alias | Version |
| --- | --- |
| latestJava | 26.2 |
| latestPaper | 26.2 |
| latestWithDatapackSchemaSurface | 26.2 |
| latestWithPaperApiSurface | 26.2 |
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
  version. Package indexes may still exist when this cell is blank.
- `Heavy data` means at least one domain surface is downloadable via `minecraft-skills data fetch`;
  the npm package keeps large surfaces out of the tarball.

## Version Table

| Version | Released | Data PF | Resource PF | Datapack | Resourcepack | Paper | Paper build | Paper API surface | Heavy data |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 26.2 | 2026-06-16 | 107.1 | 88.0 | ✅ | ✅ | ✅ | 30 | ✅ | ✅ |
| 26.1.2 | 2026-04-09 | 101.1 | 84.0 | ✅ | ✅ | ✅ | 72 | ✅ | ✅ |
| 26.1.1 | 2026-04-01 | 101.1 | 84.0 | ✅ | ✅ | ✅ | 29 | ✅ | ✅ |
| 26.1 | 2026-03-24 | 101.1 | 84.0 | ✅ | ✅ |  |  |  | ✅ |
| 1.21.11 | 2025-12-09 | 94.1 | 75.0 | ✅ | ✅ | ✅ | 132 | ✅ | ✅ |
| 1.21.10 | 2025-10-07 | 88.0 | 69.0 | ✅ | ✅ | ✅ | 130 | ✅ | ✅ |
| 1.21.9 | 2025-09-30 | 88.0 | 69.0 | ✅ | ✅ | ✅ | 59 | ✅ | ✅ |
| 1.21.8 | 2025-07-17 | 81 | 64 | ✅ | ✅ | ✅ | 60 | ✅ | ✅ |
| 1.21.7 | 2025-06-30 | 81 | 64 | ✅ | ✅ | ✅ | 32 | ✅ | ✅ |
| 1.21.6 | 2025-06-17 | 80 | 63 | ✅ | ✅ | ✅ | 48 | ✅ | ✅ |
| 1.21.5 | 2025-03-25 | 71 | 55 | ✅ | ✅ | ✅ | 114 | ✅ | ✅ |
| 1.21.4 | 2024-12-03 | 61 | 46 | ✅ | ✅ | ✅ | 232 | ✅ | ✅ |
| 1.21.3 | 2024-10-23 | 57 | 42 | ✅ | ✅ | ✅ | 83 | ✅ | ✅ |
| 1.21.2 | 2024-10-22 | 57 | 42 | ✅ | ✅ |  |  |  | ✅ |
| 1.21.1 | 2024-08-08 | 48 | 34 | ✅ | ✅ | ✅ | 133 | ✅ | ✅ |
| 1.21 | 2024-06-13 | 48 | 34 | ✅ | ✅ | ✅ | 130 |  | ✅ |
| 1.20.6 | 2024-04-29 | 41 | 32 | ✅ | ✅ | ✅ | 151 | ✅ | ✅ |
| 1.20.5 | 2024-04-23 | 41 | 32 | ✅ | ✅ | ✅ | 22 | ✅ | ✅ |
| 1.20.4 | 2023-12-07 | 26 | 22 | ✅ | ✅ | ✅ | 499 | ✅ | ✅ |
| 1.20.3 | 2023-12-04 | 26 | 22 | ✅ | ✅ |  |  |  | ✅ |
| 1.20.2 | 2023-09-20 | 18 | 18 | ✅ | ✅ | ✅ | 318 | ✅ | ✅ |
| 1.20.1 | 2023-06-12 | 15 | 15 | ✅ | ✅ | ✅ | 196 | ✅ | ✅ |
| 1.20 | 2023-06-02 | 15 | 15 | ✅ | ✅ | ✅ | 17 |  | ✅ |
| 1.19.4 | 2023-03-14 | 12 | 13 | ✅ | ✅ | ✅ | 550 | ✅ | ✅ |
| 1.19.3 | 2022-12-07 | 10 | 12 | ✅ | ✅ | ✅ | 448 | ✅ | ✅ |
| 1.19.2 | 2022-08-05 | 10 | 9 | ✅ | ✅ | ✅ | 307 | ✅ | ✅ |
| 1.19.1 | 2022-07-27 | 10 | 9 | ✅ | ✅ | ✅ | 111 | ✅ | ✅ |
| 1.19 | 2022-06-07 | 10 | 9 | ✅ | ✅ | ✅ | 81 |  | ✅ |
| 1.18.2 | 2022-02-28 | 9 | 8 | ✅ | ✅ | ✅ | 388 | ✅ | ✅ |
| 1.18.1 | 2021-12-10 | 8 | 8 | ✅ | ✅ | ✅ | 216 | ✅ | ✅ |
| 1.18 | 2021-11-30 | 8 | 8 | ✅ | ✅ | ✅ | 66 |  | ✅ |
| 1.17.1 | 2021-07-06 | 7 | 7 | ✅ | ✅ | ✅ | 411 | ✅ | ✅ |
| 1.17 | 2021-06-08 | 7 | 7 | ✅ | ✅ | ✅ | 79 |  | ✅ |
| 1.16.5 | 2021-01-14 | 6 | 6 | ✅ | ✅ | ✅ | 794 | ✅ | ✅ |
| 1.16.4 | 2020-10-29 | 6 | 6 | ✅ | ✅ | ✅ | 416 | ✅ | ✅ |
| 1.16.3 | 2020-09-10 | 6 | 6 | ✅ | ✅ | ✅ | 253 | ✅ | ✅ |
| 1.16.2 | 2020-08-11 | 6 | 6 | ✅ | ✅ | ✅ | 189 | ✅ | ✅ |
| 1.16.1 | 2020-06-24 | 5 | 5 | ✅ | ✅ | ✅ | 138 | ✅ | ✅ |
| 1.16 | 2020-06-23 | 5 | 5 | ✅ | ✅ |  |  |  | ✅ |
| 1.15.2 | 2020-01-17 | 5 | 5 | ✅ | ✅ | ✅ | 393 | ✅ | ✅ |
| 1.15.1 | 2019-12-16 | 5 | 5 | ✅ | ✅ | ✅ | 62 | ✅ | ✅ |
| 1.15 | 2019-12-09 | 5 | 5 | ✅ | ✅ | ✅ | 21 |  | ✅ |
| 1.14.4 | 2019-07-19 | 4 | 4 | ✅ | ✅ | ✅ | 245 | ✅ | ✅ |
| 1.14.3 | 2019-06-24 | 4 | 4 | ✅ | ✅ | ✅ | 134 | ✅ | ✅ |
| 1.14.2 | 2019-05-27 | 4 | 4 | ✅ | ✅ | ✅ | 107 | ✅ | ✅ |
| 1.14.1 | 2019-05-13 | 4 | 4 | ✅ | ✅ | ✅ | 50 | ✅ | ✅ |
| 1.14 | 2019-04-23 | 4 | 4 | ✅ | ✅ | ✅ | 17 |  | ✅ |
| 1.13.2 | 2018-10-22 | 4 | 4 | ✅ | ✅ | ✅ | 657 | ✅ | ✅ |
| 1.13.1 | 2018-08-22 | 4 | 4 | ✅ | ✅ | ✅ | 386 | ✅ | ✅ |
| 1.13 | 2018-07-18 | 4 | 4 | ✅ | ✅ | ✅ | 173 |  | ✅ |

## Notes

- Paper latest supported version is 26.2. Versions without Paper support: 26.1, 1.21.2, 1.20.3, 1.16.
- Paper API package indexes exist, but type/member surfaces are unavailable for: 1.13, 1.14, 1.15, 1.17, 1.18, 1.19, 1.20, 1.21.
