# WAVE audio inspection boundary

`@minecraft-skills/catalog` exposes `inspectWaveAudio(bytes)` for bounded, non-mutating inspection
of PCM and IEEE-float RIFF/WAVE source files before resource-pack conversion.

The parser follows Microsoft's primary RIFF and WAVE structure references:

- [Resource Interchange File Format (RIFF)](https://learn.microsoft.com/en-us/windows/win32/xaudio2/resource-interchange-file-format--riff-)
- [WAVEFORMATEX](https://learn.microsoft.com/en-us/windows/win32/api/mmreg/ns-mmreg-waveformatex)
- [WAVEFORMATEXTENSIBLE](https://learn.microsoft.com/en-us/windows/win32/api/mmreg/ns-mmreg-waveformatextensible)

It reports container metadata, duration, SHA-256, sample peak dBFS, unweighted sample RMS dBFS, and
`atOrBeyondFullScaleSampleCount`: the number of samples at integer endpoints (or with absolute float
magnitude at least `1.0`). That factual count does not prove that a waveform was clipped. A silent
signal has an explicit `silence` state and JSON-safe `null` dBFS values.

For `WAVE_FORMAT_EXTENSIBLE`, the channel mask is reported as authored. A zero mask is permitted as
`SPEAKER_DIRECTOUT`; a nonzero mask whose set-bit count differs from the channel count produces a
warning without making the inspection result invalid.

The parser accepts RIFF child chunks in any order. For a `fmt` chunk with `cbSize`, bytes beyond the
declared extension are retained inside the bounded file snapshot but reported as an ambiguity
warning rather than silently treated as format metadata.

This API does not convert or modify audio, recommend gain, normalize, or measure LUFS, SPL, or
perceived loudness. It also does not treat stereo or an arbitrary positive sample rate as an error.

This boundary is separate from resource-pack output validation. Minecraft Java resource-pack sound
assets remain Ogg Vorbis: `resourcepack validate-project` checks `sounds.json` references and the
bounded Ogg/Vorbis identification page. The WAVE inspector neither replaces nor repeats that Ogg
validation, and it does not prove compatibility with every audio decoder.
