import java.io.InputStream;
import java.lang.reflect.*;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.zip.ZipFile;

/**
 * Run with JDK 25: java ExtractEntityMetadata.java <version> <server.jar> <mappings|-> <output.json>
 * Verifies official artifacts, bootstraps isolated official classes, and reads static declarations.
 * No world or entity instance is created. This is a maintainer extraction tool, not a server launcher.
 */
public final class ExtractEntityMetadata {
    private static final Map<String, String> SERVERS = Map.of(
        "26.2", "823e2250d24b3ddac457a60c92a6a941943fcd6a",
        "1.21.11", "64bb6d763bed0a9f1d632ec347938594144943ed");
    private static final String MAPPINGS_SHA1 = "5621e9253f05fd57872bbe7f8ddf5f9a7d525955";
    private static final long MAX_JAR_BYTES = 256L * 1024 * 1024;
    private final Map<String, String> classes = new HashMap<>(), reverseClasses = new HashMap<>();
    private final Map<String, Map<String, Set<String>>> methods = new HashMap<>();
    private final Map<String, Map<String, String>> fields = new HashMap<>();
    private final ClassLoader loader;

    private ExtractEntityMetadata(ClassLoader loader, Path mappings) throws Exception {
        this.loader = loader;
        if (mappings == null) return;
        String owner = null;
        for (String line : Files.readAllLines(mappings, StandardCharsets.UTF_8)) {
            if (line.startsWith("#") || !line.contains(" -> ")) continue;
            String[] pair = line.trim().split(" -> ", 2);
            if (!line.startsWith(" ")) {
                owner = pair[0];
                String obfuscated = pair[1].substring(0, pair[1].length() - 1);
                if (classes.put(owner, obfuscated) != null || reverseClasses.put(obfuscated, owner) != null)
                    throw new IllegalArgumentException("Duplicate class mapping");
            } else if (owner != null) {
                String declaration = pair[0];
                int open = declaration.indexOf('(');
                String beforeArguments = open < 0 ? declaration : declaration.substring(0, open);
                String name = beforeArguments.substring(beforeArguments.lastIndexOf(' ') + 1);
                if (open < 0) {
                    String previous = fields.computeIfAbsent(owner, key -> new HashMap<>()).put(pair[1], name);
                    if (previous != null && !previous.equals(name)) throw new IllegalArgumentException("Ambiguous field mapping");
                } else {
                    methods.computeIfAbsent(owner, key -> new HashMap<>())
                        .computeIfAbsent(name, key -> new HashSet<>()).add(pair[1]);
                }
            }
        }
    }

    private Class<?> cls(String name) throws ClassNotFoundException {
        return Class.forName(classes.getOrDefault(name, name), true, loader);
    }

    private Method method(String owner, String name, Class<?>... arguments) throws Exception {
        Method found = null;
        for (String mapped : methods.getOrDefault(owner, Map.of()).getOrDefault(name, Set.of(name))) {
            try {
                Method candidate = cls(owner).getDeclaredMethod(mapped, arguments);
                if (found != null) throw new IllegalStateException("Ambiguous method: " + owner + "." + name);
                found = candidate;
            } catch (NoSuchMethodException ignored) { }
        }
        if (found == null) throw new NoSuchMethodException(owner + "." + name);
        found.setAccessible(true);
        return found;
    }

    private String original(String name) { return reverseClasses.getOrDefault(name, name); }

    private String fieldName(Field field) {
        if (classes.isEmpty()) return field.getName();
        String result = fields.getOrDefault(original(field.getDeclaringClass().getName()), Map.of()).get(field.getName());
        if (result == null) throw new IllegalStateException("Unmapped field in " + original(field.getDeclaringClass().getName()));
        return result;
    }

    private String typeName(Type type) {
        if (type instanceof Class<?> value) return value.isArray() ? typeName(value.getComponentType()) + "[]" : original(value.getName());
        if (type instanceof ParameterizedType value) return typeName(value.getRawType()) + "<" +
            String.join(", ", Arrays.stream(value.getActualTypeArguments()).map(this::typeName).toList()) + ">";
        if (type instanceof GenericArrayType value) return typeName(value.getGenericComponentType()) + "[]";
        if (type instanceof WildcardType value) {
            if (value.getLowerBounds().length > 0) return "? super " + typeName(value.getLowerBounds()[0]);
            Type[] upper = value.getUpperBounds();
            return upper.length == 0 || upper[0] == Object.class ? "?" : "? extends " + typeName(upper[0]);
        }
        throw new IllegalStateException("Unresolved generic type: " + type.getTypeName());
    }

    private Map<String, Object> extract(String version, String serverHash, String mappingsHash) throws Exception {
        method("net.minecraft.SharedConstants", "tryDetectVersion").invoke(null);
        method("net.minecraft.server.Bootstrap", "bootStrap").invoke(null);
        String accessorName = "net.minecraft.network.syncher.EntityDataAccessor";
        String serializersName = "net.minecraft.network.syncher.EntityDataSerializers";
        Class<?> accessor = cls(accessorName), serializer = cls("net.minecraft.network.syncher.EntityDataSerializer");
        Class<?> entityType = cls("net.minecraft.world.entity.EntityType");
        Method id = method(accessorName, "id"), getSerializer = method(accessorName, "serializer");
        Method serializerId = method(serializersName, "getSerializedId", serializer);
        Method getKey = method("net.minecraft.world.entity.EntityType", "getKey", entityType);
        Map<Object, Field> serializers = new IdentityHashMap<>();
        for (Field field : cls(serializersName).getDeclaredFields()) {
            if (!Modifier.isStatic(field.getModifiers()) || !serializer.isAssignableFrom(field.getType())) continue;
            field.setAccessible(true);
            Object value = field.get(null);
            if (value == null || serializers.put(value, field) != null) throw new IllegalStateException("Null or aliased serializer declaration");
        }
        Class<?> constants = version.equals("26.2") ? cls("net.minecraft.world.entity.EntityTypes") : entityType;
        Map<String, Object> entities = new TreeMap<>();
        List<Map<String, Object>> gaps = new ArrayList<>();
        Set<String> discovered = new TreeSet<>();
        Field[] entityFields = constants.getDeclaredFields();
        Arrays.sort(entityFields, Comparator.comparing(Field::getName));
        for (Field field : entityFields) {
            if (!Modifier.isStatic(field.getModifiers()) || field.getType() != entityType) continue;
            field.setAccessible(true);
            String key = getKey.invoke(null, field.get(null)).toString();
            if (!discovered.add(key)) throw new IllegalStateException("Duplicate entity ID: " + key);
            try {
                if (!(field.getGenericType() instanceof ParameterizedType generic)) throw new IllegalStateException("Missing entity generic class");
                Type argument = generic.getActualTypeArguments()[0];
                Class<?> entityClass = argument instanceof Class<?> value ? value :
                    argument instanceof ParameterizedType value && value.getRawType() instanceof Class<?> raw ? raw : null;
                if (entityClass == null) throw new IllegalStateException("Unresolved entity generic class");
                Class.forName(entityClass.getName(), true, loader);
                List<String> hierarchy = new ArrayList<>();
                List<Map<String, Object>> metadata = new ArrayList<>();
                Set<Integer> indexes = new HashSet<>();
                for (Class<?> owner = entityClass; owner != null && owner != Object.class; owner = owner.getSuperclass()) {
                    hierarchy.add(original(owner.getName()));
                    for (Field data : owner.getDeclaredFields()) {
                        if (!Modifier.isStatic(data.getModifiers()) || !accessor.isAssignableFrom(data.getType())) continue;
                        data.setAccessible(true);
                        Object value = data.get(null);
                        if (value == null) throw new IllegalStateException("Null accessor declaration");
                        int index = ((Number) id.invoke(value)).intValue();
                        Object encoding = getSerializer.invoke(value);
                        Field serializerField = serializers.get(encoding);
                        int encodingId = ((Number) serializerId.invoke(null, encoding)).intValue();
                        if (index < 0 || index > 254 || !indexes.add(index) || encodingId < 0 || serializerField == null)
                            throw new IllegalStateException("Invalid index or serializer declaration");
                        if (!(data.getGenericType() instanceof ParameterizedType dataType) || dataType.getActualTypeArguments().length != 1)
                            throw new IllegalStateException("Missing accessor value type");
                        Map<String, Object> item = new LinkedHashMap<>();
                        item.put("index", index);
                        item.put("declaredIn", original(owner.getName()));
                        item.put("accessor", fieldName(data));
                        item.put("valueType", typeName(dataType.getActualTypeArguments()[0]));
                        item.put("serializer", fieldName(serializerField));
                        item.put("serializerId", encodingId);
                        metadata.add(item);
                    }
                    if (hierarchy.size() > 64) throw new IllegalStateException("Excessive class hierarchy");
                }
                metadata.sort(Comparator.comparingInt(item -> ((Number) item.get("index")).intValue()));
                for (int index = 0; index < metadata.size(); index++) {
                    if (((Number) metadata.get(index).get("index")).intValue() != index) throw new IllegalStateException("Non-contiguous accessor indexes");
                }
                if (metadata.isEmpty()) throw new IllegalStateException("No inherited accessor declarations");
                Map<String, Object> entity = new LinkedHashMap<>();
                entity.put("className", original(entityClass.getName()));
                entity.put("hierarchy", hierarchy);
                entity.put("metadata", metadata);
                entities.put(key, entity);
            } catch (ReflectiveOperationException | IllegalStateException | LinkageError error) {
                String detail = error.getClass().getSimpleName() + ": " + String.valueOf(error.getMessage());
                gaps.add(Map.of("entityId", key, "code", "declaration-extraction-failed", "detail", detail.substring(0, Math.min(detail.length(), 512))));
            }
            if (discovered.size() > 4096) throw new IllegalStateException("Excessive entity declarations");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("schemaVersion", 1);
        result.put("version", version);
        result.put("serverSha1", serverHash);
        result.put("mappingsSha1", mappingsHash);
        result.put("discoveredEntityIds", discovered);
        result.put("entities", entities);
        result.put("gaps", gaps);
        return result;
    }

    private static String digest(byte[] bytes, String algorithm) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance(algorithm).digest(bytes));
    }

    private static byte[] boundedFile(Path path, long maximum) throws Exception {
        if (!Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS) || Files.size(path) > maximum)
            throw new IllegalArgumentException("Expected a bounded regular artifact: " + path.getFileName());
        try (InputStream stream = Files.newInputStream(path)) {
            byte[] bytes = stream.readNBytes(Math.toIntExact(maximum + 1));
            if (bytes.length > maximum) throw new IllegalArgumentException("Artifact exceeds byte limit");
            return bytes;
        }
    }

    private static byte[] zipEntry(ZipFile archive, String name, int maximum) throws Exception {
        var entry = archive.getEntry(name);
        if (entry == null || entry.isDirectory() || entry.getSize() > maximum) throw new IllegalArgumentException("Invalid bundled entry: " + name);
        try (InputStream stream = archive.getInputStream(entry)) {
            byte[] bytes = stream.readNBytes(maximum + 1);
            if (bytes.length > maximum) throw new IllegalArgumentException("Bundled entry exceeds byte limit");
            return bytes;
        }
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 4 || !SERVERS.containsKey(args[0])) throw new IllegalArgumentException("Expected <26.2|1.21.11> <server.jar> <mappings|-> <output.json>");
        String version = args[0], expectedHash = SERVERS.get(version);
        Path server = Path.of(args[1]), mappings = args[2].equals("-") ? null : Path.of(args[2]);
        byte[] serverBytes = boundedFile(server, MAX_JAR_BYTES);
        byte[] mappingsBytes = mappings == null ? null : boundedFile(mappings, 16 * 1024 * 1024);
        if (!digest(serverBytes, "SHA-1").equals(expectedHash)) throw new IllegalArgumentException("Official server SHA-1 mismatch");
        if (version.equals("1.21.11") && (mappingsBytes == null || !digest(mappingsBytes, "SHA-1").equals(MAPPINGS_SHA1)))
            throw new IllegalArgumentException("Official mappings SHA-1 mismatch");
        if (version.equals("26.2") && mappings != null) throw new IllegalArgumentException("26.2 uses official unobfuscated names; pass - for mappings");
        Path temporary = Files.createTempDirectory("minecraft-entity-metadata-");
        java.net.URLConnection.setDefaultUseCaches("jar", false);
        ClassLoader originalLoader = Thread.currentThread().getContextClassLoader();
        try {
            Path verifiedServer = temporary.resolve("server.jar");
            Files.write(verifiedServer, serverBytes, StandardOpenOption.CREATE_NEW);
            Path verifiedMappings = null;
            if (mappingsBytes != null) {
                verifiedMappings = temporary.resolve("mappings.txt");
                Files.write(verifiedMappings, mappingsBytes, StandardOpenOption.CREATE_NEW);
            }
            List<URL> urls = new ArrayList<>();
            long totalBytes = 0;
            try (ZipFile archive = new ZipFile(verifiedServer.toFile())) {
                for (String section : List.of("versions", "libraries")) {
                    String manifest = new String(zipEntry(archive, "META-INF/" + section + ".list", 256 * 1024), StandardCharsets.UTF_8);
                    for (String line : manifest.lines().filter(value -> !value.isBlank()).toList()) {
                        String[] columns = line.split("\t", -1);
                        if (columns.length != 3 || !columns[0].matches("[0-9a-f]{64}") || !columns[2].matches("[a-zA-Z0-9._/-]+\\.jar") || columns[2].startsWith("/") || Arrays.asList(columns[2].split("/", -1)).stream().anyMatch(value -> value.equals("..") || value.isEmpty()))
                            throw new IllegalArgumentException("Invalid bundler manifest row");
                        byte[] bytes = zipEntry(archive, "META-INF/" + section + "/" + columns[2], 128 * 1024 * 1024);
                        totalBytes += bytes.length;
                        if (totalBytes > 512L * 1024 * 1024 || urls.size() >= 256 || !digest(bytes, "SHA-256").equals(columns[0])) throw new IllegalArgumentException("Bundled artifact hash or budget mismatch");
                        Path output = temporary.resolve(urls.size() + ".jar");
                        Files.write(output, bytes, StandardOpenOption.CREATE_NEW);
                        urls.add(output.toUri().toURL());
                    }
                }
            }
            try (URLClassLoader isolated = new URLClassLoader(urls.toArray(URL[]::new), ClassLoader.getPlatformClassLoader())) {
                Thread.currentThread().setContextClassLoader(isolated);
                var extractor = new ExtractEntityMetadata(isolated, verifiedMappings);
                var report = extractor.extract(version, expectedHash, mappings == null ? null : MAPPINGS_SHA1);
                Class<?> gson = Class.forName("com.google.gson.Gson", true, isolated);
                String json = (String) gson.getMethod("toJson", Object.class).invoke(gson.getConstructor().newInstance(), report);
                Files.writeString(Path.of(args[3]), json + "\n", StandardCharsets.UTF_8);
                System.out.println("Extracted " + ((Map<?, ?>) report.get("entities")).size() + " entity types; gaps: " + ((List<?>) report.get("gaps")).size());
            }
        } finally {
            Thread.currentThread().setContextClassLoader(originalLoader);
            try (var paths = Files.walk(temporary)) {
                for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
            }
        }
    }
}
