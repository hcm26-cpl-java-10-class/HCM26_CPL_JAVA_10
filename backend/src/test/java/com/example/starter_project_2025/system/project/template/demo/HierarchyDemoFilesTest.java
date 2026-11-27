package com.example.starter_project_2025.system.project.template.demo;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.zip.ZipFile;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.jupiter.api.Assertions.*;

class HierarchyDemoFilesTest {
    @TempDir Path directory;

    @Test void preparesRequiredAssetsAndPreservesExistingSamples() throws Exception {
        var demo = new HierarchyDemoFiles(null, null, null, null);
        ReflectionTestUtils.setField(demo, "samplesPath", directory.toString());
        demo.prepareSamples();
        for (String name : List.of("architecture-spec.pdf", "git-guideline.pdf", "auth-spec.pdf",
                "auth-sample.csv", "payment-api.pdf", "catalog-spec.pdf", "unsupported.txt")) {
            assertTrue(Files.size(directory.resolve(name)) > 0, name);
        }
        try (var zip = new ZipFile(directory.resolve("payment-sdk.zip").toFile())) {
            assertEquals(3, zip.size());
            assertNotNull(zip.getEntry("README.md"));
            assertNotNull(zip.getEntry("create-payment.json"));
            assertNotNull(zip.getEntry("payment-callback.json"));
        }
        Files.writeString(directory.resolve("unsupported.txt"), "existing sample");
        demo.prepareSamples();
        assertEquals("existing sample", Files.readString(directory.resolve("unsupported.txt")));
    }
}
