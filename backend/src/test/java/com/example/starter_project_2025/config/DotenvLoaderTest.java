package com.example.starter_project_2025.config;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class DotenvLoaderTest {

    private String originalDotenvFile;
    private String originalTestKey;

    @BeforeEach
    void setUp() {
        originalDotenvFile = System.getProperty("dotenv.file");
        originalTestKey = System.getProperty("TEST_DOTENV_KEY");
        DotenvLoader.resetCache();
    }

    @AfterEach
    void tearDown() {
        if (originalDotenvFile != null) {
            System.setProperty("dotenv.file", originalDotenvFile);
        } else {
            System.clearProperty("dotenv.file");
        }

        if (originalTestKey != null) {
            System.setProperty("TEST_DOTENV_KEY", originalTestKey);
        } else {
            System.clearProperty("TEST_DOTENV_KEY");
        }
        System.clearProperty("GEMINI_API_KEY_TEST_MOCK");
        DotenvLoader.resetCache();
    }

    @Test
    void parseLine_standardKeyValue_parsedSuccessfully() {
        Map<String, Object> map = new HashMap<>();
        DotenvLoader.parseLine("GEMINI_API_KEY=AIzaSyFakeKey123456789", map);

        assertEquals("AIzaSyFakeKey123456789", map.get("GEMINI_API_KEY"));
    }

    @Test
    void parseLine_doubleAndSingleQuotedValues_quotesStripped() {
        Map<String, Object> map = new HashMap<>();
        DotenvLoader.parseLine("KEY_DOUBLE=\"secret-value-double\"", map);
        DotenvLoader.parseLine("KEY_SINGLE='secret-value-single'", map);

        assertEquals("secret-value-double", map.get("KEY_DOUBLE"));
        assertEquals("secret-value-single", map.get("KEY_SINGLE"));
    }

    @Test
    void parseLine_withExportPrefix_parsedCorrectly() {
        Map<String, Object> map = new HashMap<>();
        DotenvLoader.parseLine("export GEMINI_API_KEY=\"AIzaSyExportedKey\"", map);

        assertEquals("AIzaSyExportedKey", map.get("GEMINI_API_KEY"));
    }

    @Test
    void parseLine_commentsAndEmptyLines_ignored() {
        Map<String, Object> map = new HashMap<>();
        DotenvLoader.parseLine("# This is a comment", map);
        DotenvLoader.parseLine("   # Indented comment", map);
        DotenvLoader.parseLine("", map);
        DotenvLoader.parseLine("   ", map);
        DotenvLoader.parseLine("INVALID_LINE_WITHOUT_EQUALS", map);

        assertTrue(map.isEmpty());
    }

    @Test
    void parseLine_whitespaceAroundKeysAndValues_trimmed() {
        Map<String, Object> map = new HashMap<>();
        DotenvLoader.parseLine("   GEMINI_API_KEY   =   AIzaSyKeyWithSpaces   ", map);

        assertEquals("AIzaSyKeyWithSpaces", map.get("GEMINI_API_KEY"));
    }

    @Test
    void stripQuotes_handlesVariousInputs() {
        assertEquals("", DotenvLoader.stripQuotes(null));
        assertEquals("", DotenvLoader.stripQuotes(""));
        assertEquals("abc", DotenvLoader.stripQuotes("abc"));
        assertEquals("hello", DotenvLoader.stripQuotes("\"hello\""));
        assertEquals("world", DotenvLoader.stripQuotes("'world'"));
        assertEquals("mixed\"quote", DotenvLoader.stripQuotes("mixed\"quote"));
    }

    @Test
    void load_fromCustomFile_readsPropertiesAndSetsSystemProperty(@TempDir Path tempDir) throws IOException {
        Path envPath = tempDir.resolve(".env");
        Files.writeString(envPath, """
                # Sample configuration
                GEMINI_API_KEY_TEST_MOCK=AIzaSyFromDotenvFile987
                TEST_NUMBER=42
                """);

        System.setProperty("dotenv.file", envPath.toAbsolutePath().toString());
        DotenvLoader.resetCache();

        Map<String, Object> loaded = DotenvLoader.load();

        assertNotNull(loaded);
        assertEquals("AIzaSyFromDotenvFile987", loaded.get("GEMINI_API_KEY_TEST_MOCK"));
        assertEquals("AIzaSyFromDotenvFile987", System.getProperty("GEMINI_API_KEY_TEST_MOCK"));
    }

    @Test
    void load_doesNotOverwritePreExistingSystemProperty(@TempDir Path tempDir) throws IOException {
        System.setProperty("TEST_DOTENV_KEY", "PreExistingSystemValue");

        Path envPath = tempDir.resolve(".env");
        Files.writeString(envPath, "TEST_DOTENV_KEY=ValueFromDotenvFile");

        System.setProperty("dotenv.file", envPath.toAbsolutePath().toString());
        DotenvLoader.resetCache();

        Map<String, Object> loaded = DotenvLoader.load();

        // The loaded map reflects what was in the file
        assertEquals("ValueFromDotenvFile", loaded.get("TEST_DOTENV_KEY"));
        // BUT the system property was NOT overwritten
        assertEquals("PreExistingSystemValue", System.getProperty("TEST_DOTENV_KEY"));
    }

    @Test
    void load_nonExistentFile_returnsEmptyMapWithoutCrashing() {
        System.setProperty("dotenv.file", "C:\\non_existent_path_xyz_123\\.env");
        DotenvLoader.resetCache();

        Map<String, Object> loaded = DotenvLoader.load();

        assertNotNull(loaded);
        assertTrue(loaded.isEmpty());
    }
}
