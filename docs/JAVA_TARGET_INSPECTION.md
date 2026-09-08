# Java Target Inspection

This offline inspection finds Java classfile target requirements throughout a JAR, including helper
and shaded classes that a plugin entrypoint check would miss. It can explain classfile version
mismatches without loading code, extracting files, or inferring Minecraft/plugin API compatibility.

## Interfaces

```sh
minecraft-skills minecraft inspect-java-targets ./example.jar --java 21
minecraft-skills minecraft inspect-java-targets ./example.jar --java 25 --enable-preview
```

Catalog `inspectJavaJarTargets({ archive, targetJavaRelease, previewEnabled? })` receives a
`Uint8Array`. CLI reads a regular `.jar` file with bounded size and file identity checks, refusing
symlinks and special files. Exit 0 requires a complete compatible scan; incompatible or unknown
results return 1 with JSON. Invalid options or local file errors return 1 with stderr.

MCP `inspect_java_targets` and Catalog `validateJavaTargetMetadata` receive extracted metadata:

```json
{
  "targetJavaRelease": 21,
  "previewEnabled": false,
  "multiRelease": false,
  "classEntriesComplete": true,
  "classes": [
    { "path": "example/Main.class", "majorVersion": 65, "minorVersion": 0 }
  ]
}
```

Java release is required and restricted to the source-audited 8–26 range. Preview defaults to false.
These values describe supplied runtime settings; actual Java executables and JVM flags are not
observed. `classEntriesComplete` is a caller claim about this archive's class entries, excluding
nested archives and the runtime classpath. `multiRelease: null` means unknown manifest state; both
version fields must be null when a class could not be inspected. Unsafe paths, duplicates, accessors,
unknown properties, invalid version fields and oversized inputs are rejected. MCP accepts no local
path or binary payload.

## Selection and Results

When main-manifest `Multi-Release` is true and Java is at least 9, each logical class path selects the
highest canonical `META-INF/versions/N/` directory with `9 <= N <= targetJavaRelease`, falling back
to its root entry. Folded manifest values and case-insensitive attribute names/true values are
supported. Entry-specific manifest sections do not enable multi-release behavior. Ambiguous main
attributes leave the setting unknown. Invalid version directories, versioned `META-INF` resources,
and root `module-info.class` on Java 8 do not become effective classes. Boot class paths and custom
loaders can use different rules.
When a class entry list is incomplete and multi-release behavior is enabled or unknown, selection
stays unresolved: an omitted eligible version may override a supplied class, including a root class
whose own version fields are incompatible. Incomplete non-multi-release lists can still prove a
supplied class has incompatible targets, while overall scan completeness remains false.

On Java 12+, major 45–55 permits any unsigned minor value. Java 8–11 only accepts minor zero for
its highest supported major, while lower supported majors accept any minor. For major 56 onward
only minor 0 and 65535 are valid;
65535 means preview and requires the exact Java release with preview enabled. A later release cannot
load an earlier preview class. Version-directory targets above their named release receive a format
warning, separate from whether the supplied runtime supports the selected version fields.

`targetCompatible` is false when a definitively selected class has incompatible fields, null when
requirements remain unknown, and true when the supplied classfile target evidence is compatible.
It says nothing about successful JVM verification, execution, linkage or platform APIs. A known
incompatible selected class remains false even if other entries are unknown. `scanComplete` separately
records incomplete inventory, unreadable class data, unknown manifest state, or nested archives.
An empty set of effective classes stays unknown. `minimumJavaRelease` summarizes selected non-preview
class targets only; it is null for unresolved or nonzero-minor requirements and is not a minimum supported
runtime for the entire JAR, especially when different runtimes select different multi-release entries.

`evidence.strength` distinguishes `binary` and `metadata`; all archive/class byte-verification flags
remain false for metadata input. The binary scanner validates ZIP structure and checks CRC/inflated
size for classfiles and the manifest it reads. Other resources, nested JARs, signatures, module
resolution, classpath dependencies, declared-name/path identity and multi-release public API parity
are not validated. Binary nested JAR entries are counted and leave overall requirements unknown.
Each returned class includes its selected state, logical path and ignored reason; output truncation
does not stop assessment of later input classes.

## Fixed Limits

| Limit | Maximum |
| --- | --- |
| Archive bytes | 64 MiB |
| Archive entries / supplied class records | 16,384 |
| Entry path length | 1,024 characters |
| Declared archive expansion | 512 MiB, 200:1 per entry |
| Manifest bytes | 256 KiB |
| Individual / cumulative inspected class bytes | 8 MiB / 64 MiB |
| Returned classes / diagnostics | 200 / 200, with total and omitted counts |

Malformed, encrypted, ZIP64, duplicate-name, unsafe-path and inconsistent archives are not treated as
verified input. Per-class size, structure, integrity and cumulative limits retain unknown class
records instead of declaring a complete scan. ZIP structure inspection and full bounded classfile
parsing share the existing archive and Velocity classfile readers; neither executes class bytecode.

The format rules come from the [Java SE 26 JVM specification](https://docs.oracle.com/javase/specs/jvms/se26/html/jvms-4.html#jvms-4.1)
and its [historical Java 8–11 version ranges](https://docs.oracle.com/javase/specs/jvms/se11/html/jvms-4.html#jvms-4.1),
plus the [JAR specification](https://docs.oracle.com/en/java/javase/25/docs/specs/jar/jar.html#multi-release-jar-files).
