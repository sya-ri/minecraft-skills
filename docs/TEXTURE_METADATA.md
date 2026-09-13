# Texture metadata checks

Catalog: `validateTextureMetadata(metadata, width, height)`.
CLI: `minecraft-skills validate-texture-metadata input.json`.
MCP: `validate_texture_metadata` with `metadata`, `width`, and `height`.

```json
{"metadata":{"animation":{"frametime":2,"frames":[0,{"index":3,"time":20}]}},"width":16,"height":64}
```

Validate the PNG container separately and use its actual dimensions. The common profile checks
animation width/height, positive timing, interpolation flags and frame indices; texture blur/clamp;
and villager hat choices. Without explicit dimensions frames are square using the smaller image
dimension. A single explicit width keeps the whole image height, and vice versa. Frames must tile
the image exactly. Unknown fields/sections, empty frame lists and more than 100,000 frame entries
produce incomplete results that never pass. CLI input is a bounded regular JSON file up to 1 MiB;
links and special files are refused. Diagnostics and unsupported paths retain at most 100 samples.

This is a conservative common-shape checker, not a normative version schema. Verify target support
using version data or the actual client's metadata codecs. New texture options intentionally remain
unsupported until their semantics are implemented. It neither decodes PNG pixels nor checks atlas
use, animation phase, model selection or rendering. Passing metadata checks alone does not establish
migration equivalence. Dimensions supplied by a caller are not independently authenticated.

The common frame-size calculation and fields were cross-checked against Mojang's client metadata
codec and FrameSize calculation, without bundling any Minecraft executable or game assets.
