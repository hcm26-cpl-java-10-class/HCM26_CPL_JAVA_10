package com.example.starter_project_2025.architecture;

import org.junit.jupiter.api.Test;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertTrue;

class SourcePackageStructureTest {
    private static final Pattern PACKAGE = Pattern.compile("(?m)^\\s*package\\s+([\\w.]+)\\s*;");

    @Test
    void packageDeclarationsMatchSourceFolders() throws IOException {
        Path base = Path.of(System.getProperty("basedir", "."));
        List<String> mismatches = new ArrayList<>();
        for (String sourceDirectory : List.of("src/main/java", "src/test/java")) {
            Path sourceRoot = base.resolve(sourceDirectory);
            assertTrue(Files.isDirectory(sourceRoot), "Source directory is missing: " + sourceRoot);
            try (var paths = Files.walk(sourceRoot)) {
                for (Path file : paths.filter(path -> path.toString().endsWith(".java")).toList()) {
                    var declaration = PACKAGE.matcher(Files.readString(file, StandardCharsets.UTF_8));
                    if (!declaration.find()) continue;
                    String expected = sourceRoot.relativize(file.getParent()).toString().replace(File.separatorChar, '.');
                    if (!expected.equals(declaration.group(1))) {
                        mismatches.add(sourceRoot.relativize(file) + ": expected " + expected
                                + ", declared " + declaration.group(1));
                    }
                }
            }
        }
        assertTrue(mismatches.isEmpty(), () -> "Java packages must match their source folders:\n"
                + String.join("\n", mismatches));
    }
}
