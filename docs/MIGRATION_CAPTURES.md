# Compare migration captures

`minecraft-skills compare-migration-captures before.json after.json` compares decoded PNG pixels.
Catalog: `compareMigrationCaptures(before, after)`.
MCP: `compare_migration_captures` with `before` and `after` objects.

```json
{"version":"source","caseId":"example:wand:idle","context":"inventory","conditions":"fixture-v1:camera-and-render-settings","pngBase64":"<base64 PNG>"}
```

Capture the same test case in each real client with fixed dimensions, UI scale, FOV, camera,
lighting, time, animation phase, item state, resource pack stack and graphics settings. Record
these in a manifest identified by `conditions`; do not reuse an identifier after changing them.
Create cases for inventory, first-person and third-person, plus head/ground/fixed when used.
The `world` context supports fixed-camera world views. Include a control item and verify the
intended model actually loaded; two missing-model screenshots can also be pixel-identical.

Captures require matching case ID, context, conditions and dimensions. Mismatches produce
`incomparable`, with no numeric pixel comparison. Versions may differ. Comparable captures report
exact RGBA equality/difference, changed pixels/fraction, maximum channel difference, bounding box
and SHA-256 of each encoded PNG. PNG encoding differences alone do not fail pixel equality.

Only static, noninterlaced, 8-bit RGB/RGBA PNGs without tRNS are supported. Input is capped at
8 MiB and 4,194,304 pixels per PNG, with bounded decompression and container/CRC validation.
CLI JSON files are bounded regular local files up to 24 MiB; links/special files are refused.
CLI exit 0 requires equality; all other verdicts/errors exit 1.

This tool does not launch clients, take screenshots or verify provenance. Supplied images may
contain personal information. No automatic cropping, tolerance, masking, alignment or baseline
replacement is applied. Investigate differences mechanically first; use manual inspection for
unexplained residual differences, not as a substitute for missing observations. Pixel equality
is limited evidence, not proof of successful item/world conversion or gameplay equivalence.
