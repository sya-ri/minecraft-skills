export type TextureMetadataResult = {
  schemaVersion: 1;
  profile: "common-texture-metadata";
  valid: boolean;
  validationComplete: boolean;
  frameSize: { width: number; height: number } | null;
  frameCount: number | null;
  diagnostics: Array<{ path: string; message: string }>;
  unsupported: string[];
};
const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const integer = (v: unknown, min = 1): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= 2_147_483_647;

/** Conservative common metadata profile, not a version-specific or rendering validator. */
export function validateTextureMetadata(
  metadata: unknown,
  width: number,
  height: number,
): TextureMetadataResult {
  const diagnostics: TextureMetadataResult["diagnostics"] = [];
  const unsupported: string[] = [];
  const markUnsupported = (path: string) => {
    if (unsupported.length < 100) unsupported.push(path);
  };
  let frameSize: TextureMetadataResult["frameSize"] = null;
  let frameCount: number | null = null;
  const error = (path: string, message: string) => {
    if (diagnostics.length < 100) diagnostics.push({ path, message });
  };
  const keys = (value: Record<string, unknown>, known: string[], path: string) => {
    for (const key of Object.keys(value).slice(0, 101))
      if (!known.includes(key)) markUnsupported(`${path}/${key}`);
    if (Object.keys(value).length > 100) markUnsupported(`${path}:key-limit`);
  };
  if (!integer(width) || !integer(height) || !Number.isSafeInteger(width * height)) {
    error("/dimensions", "Dimensions must be positive integers with a safe integer pixel count.");
  } else if (!object(metadata)) {
    error("/", "Metadata must be an object.");
  } else {
    keys(metadata, ["animation", "texture", "villager"], "");
    if (metadata.texture !== undefined) {
      const t = metadata.texture;
      if (!object(t)) error("/texture", "Texture metadata must be an object.");
      else {
        keys(t, ["blur", "clamp"], "/texture");
        for (const key of ["blur", "clamp"])
          if (t[key] !== undefined && typeof t[key] !== "boolean")
            error(`/texture/${key}`, "Expected boolean.");
      }
    }
    if (metadata.villager !== undefined) {
      const v = metadata.villager;
      if (!object(v)) error("/villager", "Villager metadata must be an object.");
      else {
        keys(v, ["hat"], "/villager");
        if (v.hat !== undefined && !["none", "partial", "full"].includes(v.hat as string))
          error("/villager/hat", "Expected none, partial or full.");
      }
    }
    if (metadata.animation !== undefined) {
      const a = metadata.animation;
      if (!object(a)) error("/animation", "Animation metadata must be an object.");
      else {
        keys(a, ["width", "height", "frametime", "frames", "interpolate"], "/animation");
        for (const key of ["width", "height", "frametime"])
          if (a[key] !== undefined && !integer(a[key]))
            error(`/animation/${key}`, "Expected a positive integer.");
        if (a.interpolate !== undefined && typeof a.interpolate !== "boolean")
          error("/animation/interpolate", "Expected boolean.");
        const w = a.width ?? (a.height === undefined ? Math.min(width, height) : width);
        const h = a.height ?? (a.width === undefined ? Math.min(width, height) : height);
        if (integer(w) && integer(h)) {
          if (width % w !== 0 || height % h !== 0)
            error("/animation", "Frame size must divide image dimensions.");
          else {
            frameSize = { width: w, height: h };
            frameCount = (width / w) * (height / h);
          }
        }
        if (a.frames !== undefined) {
          if (!Array.isArray(a.frames)) error("/animation/frames", "Expected an array.");
          else if (a.frames.length > 100_000) markUnsupported("/animation/frames:entry-limit");
          else {
            // Empty lists need runtime-specific handling; never infer successful animation.
            if (a.frames.length === 0) markUnsupported("/animation/frames:empty-list");
            for (let i = 0; i < a.frames.length; i++) {
              const frame: unknown = a.frames[i];
              const index = object(frame) ? frame.index : frame;
              if (!integer(index, 0) || (frameCount !== null && index >= frameCount))
                error(
                  `/animation/frames/${i}`,
                  "Frame index must be a nonnegative integer within the image.",
                );
              if (object(frame)) {
                keys(frame, ["index", "time"], `/animation/frames/${i}`);
                if (frame.time !== undefined && !integer(frame.time))
                  error(`/animation/frames/${i}/time`, "Expected a positive integer.");
              }
            }
          }
        }
      }
    }
  }
  return {
    schemaVersion: 1,
    profile: "common-texture-metadata",
    valid: diagnostics.length === 0 && unsupported.length === 0,
    validationComplete: unsupported.length === 0,
    frameSize,
    frameCount,
    diagnostics,
    unsupported: unsupported.slice(0, 100),
  };
}
