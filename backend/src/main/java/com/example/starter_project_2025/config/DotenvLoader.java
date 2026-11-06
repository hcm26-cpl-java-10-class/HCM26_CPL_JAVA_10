package com.example.starter_project_2025.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

/**
 * Robust, zero-dependency .env file loader for Java 21 / Spring Boot.
 * <p>
 * Features:
 * <ul>
 *   <li>Stable path resolution regardless of terminal/IDE working directory (repo root, backend/, or arbitrary path).</li>
 *   <li>Priority: System environment variables and system properties take precedence over .env file.</li>
 *   <li>Security: API keys and secret values are NEVER printed or logged.</li>
 *   <li>Supports comments (#), empty lines, quoted values ("..." or '...'), and export prefixes.</li>
 * </ul>
 */
public final class DotenvLoader {

    private static final Logger log = LoggerFactory.getLogger(DotenvLoader.class);

    private static volatile Map<String, Object> cachedProperties = null;

    private DotenvLoader() {}

    /**
     * Loads environment variables from the discovered .env file.
     * Caches the result on subsequent calls.
     *
     * @return an unmodifiable map of key-value pairs loaded from the .env file
     */
    public static synchronized Map<String, Object> load() {
        if (cachedProperties != null) {
            return cachedProperties;
        }

        File envFile = findDotenvFile();
        if (envFile == null || !envFile.isFile() || !envFile.canRead()) {
            log.info("[Dotenv] No .env file found at candidate locations (checked backend/.env and .env). Using system environment variables.");
            cachedProperties = Collections.emptyMap();
            return cachedProperties;
        }

        log.info("[Dotenv] Loading environment variables from: {}", envFile.getAbsolutePath());

        Map<String, Object> properties = new LinkedHashMap<>();
        try {
            List<String> lines = Files.readAllLines(envFile.toPath(), StandardCharsets.UTF_8);
            for (String line : lines) {
                parseLine(line, properties);
            }
        } catch (IOException e) {
            log.warn("[Dotenv] Failed to read .env file at {}: {}", envFile.getAbsolutePath(), e.getMessage());
            cachedProperties = Collections.emptyMap();
            return cachedProperties;
        }

        // Set as system property ONLY IF not already set in OS environment or system properties
        for (Map.Entry<String, Object> entry : properties.entrySet()) {
            String key = entry.getKey();
            String value = String.valueOf(entry.getValue());
            if (System.getProperty(key) == null && System.getenv(key) == null) {
                System.setProperty(key, value);
            }
        }

        cachedProperties = Collections.unmodifiableMap(properties);
        return cachedProperties;
    }

    /**
     * Resets the cached properties (useful for unit testing).
     */
    public static synchronized void resetCache() {
        cachedProperties = null;
    }

    /**
     * Parses a single line from the .env file.
     */
    static void parseLine(String line, Map<String, Object> targetMap) {
        if (line == null) {
            return;
        }
        String trimmed = line.trim();
        if (trimmed.isEmpty() || trimmed.startsWith("#")) {
            return;
        }

        if (trimmed.startsWith("export ") && trimmed.length() > 7) {
            trimmed = trimmed.substring(7).trim();
        }

        int eqIndex = trimmed.indexOf('=');
        if (eqIndex <= 0) {
            return;
        }

        String key = trimmed.substring(0, eqIndex).trim();
        String rawValue = trimmed.substring(eqIndex + 1).trim();

        String value = stripQuotes(rawValue);
        if (!key.isEmpty()) {
            targetMap.put(key, value);
        }
    }

    /**
     * Strips enclosing single or double quotes from a value.
     */
    static String stripQuotes(String value) {
        if (value == null) {
            return "";
        }
        String v = value.trim();
        if (v.length() >= 2) {
            if ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'"))) {
                return v.substring(1, v.length() - 1).trim();
            }
        }
        return v;
    }

    /**
     * Finds the .env file reliably across all execution environments:
     * 1. System property 'dotenv.file' or env 'DOTENV_FILE' (explicit override)
     * 2. Working directory: 'backend/.env' (when executed from repo root)
     * 3. Working directory: '.env' (when executed from backend/ folder)
     * 4. Walk up directory tree from DotenvLoader class location
     * 5. Parent directory: '../backend/.env' or '../.env'
     */
    public static File findDotenvFile() {
        // 1. Explicit override
        String customPath = System.getProperty("dotenv.file");
        if (customPath == null || customPath.isBlank()) {
            customPath = System.getenv("DOTENV_FILE");
        }
        if (customPath != null && !customPath.isBlank()) {
            File custom = new File(customPath.trim());
            if (custom.isFile() && custom.canRead()) {
                return custom;
            }
            return null; // Explicit override path was given but not found/readable
        }

        // 2. Working directory candidates
        String userDir = System.getProperty("user.dir", ".");
        Path userDirPath = Path.of(userDir).toAbsolutePath().normalize();

        List<Path> candidates = new ArrayList<>();
        candidates.add(userDirPath.resolve("backend").resolve(".env"));
        candidates.add(userDirPath.resolve(".env"));
        candidates.add(userDirPath.resolve("..").resolve("backend").resolve(".env").normalize());
        candidates.add(userDirPath.resolve("..").resolve(".env").normalize());

        for (Path candidate : candidates) {
            if (Files.isRegularFile(candidate) && Files.isReadable(candidate)) {
                return candidate.toFile();
            }
        }

        // 3. Walk up from code location (handles IDE runners, Maven plugins, and custom working dirs)
        try {
            URI codeUri = DotenvLoader.class.getProtectionDomain().getCodeSource().getLocation().toURI();
            Path curr = Path.of(codeUri).toAbsolutePath().normalize();
            for (int i = 0; i < 6 && curr != null; i++) {
                Path candidateBackend = curr.resolve("backend").resolve(".env");
                if (Files.isRegularFile(candidateBackend) && Files.isReadable(candidateBackend)) {
                    return candidateBackend.toFile();
                }
                Path candidateDirect = curr.resolve(".env");
                if (Files.isRegularFile(candidateDirect) && Files.isReadable(candidateDirect)) {
                    return candidateDirect.toFile();
                }
                curr = curr.getParent();
            }
        } catch (Exception ignored) {
            // Fall through if URI cannot be resolved
        }

        return null;
    }
}
