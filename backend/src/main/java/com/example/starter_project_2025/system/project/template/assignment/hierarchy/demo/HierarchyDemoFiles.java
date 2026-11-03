package com.example.starter_project_2025.system.project.template.assignment.hierarchy.demo;

import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.resources.ProjectResourceStorage;
import com.example.starter_project_2025.system.project.template.resources.TemplateResource;
import com.example.starter_project_2025.system.project.template.resources.TemplateResourceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.zip.Deflater;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Component
@RequiredArgsConstructor
public class HierarchyDemoFiles {
    private static final List<String> FILES = List.of("architecture-spec.pdf", "git-guideline.pdf",
            "auth-spec.pdf", "auth-sample.csv", "payment-api.pdf", "payment-sdk.zip", "catalog-spec.pdf", "unsupported.txt");
    private final TemplateResourceRepository resources;
    private final ProjectResourceStorage storage;
    @Value("${app.project.hierarchy-demo.samples-path:./data/hierarchy-demo/samples}")
    private String samplesPath;

    public void prepareSamples() {
        try {
            Path directory = Path.of(samplesPath).toAbsolutePath().normalize();
            Files.createDirectories(directory);
            for (String name : FILES) {
                Path target = directory.resolve(name);
                if (!Files.exists(target)) Files.write(target, bytes(name));
            }
            Path oversized = directory.resolve("oversize-30mb.zip");
            if (!Files.exists(oversized)) {
                try (var zip = new ZipOutputStream(Files.newOutputStream(oversized))) {
                    zip.setLevel(Deflater.NO_COMPRESSION);
                    zip.putNextEntry(new ZipEntry("sample-data.bin"));
                    byte[] block = new byte[1024 * 1024];
                    for (int index = 0; index < 30; index++) zip.write(block);
                    zip.closeEntry();
                }
            }
        } catch (IOException exception) {
            throw new UncheckedIOException("Unable to prepare hierarchy demo files", exception);
        }
    }

    public void attach(ProjectTemplate template, String name) {
        byte[] content = bytes(name);
        TemplateResource resource = new TemplateResource();
        resource.setTemplate(template);
        resource.setKind("FILE");
        resource.setTitle(name);
        resource.setFileName(name);
        resource.setContentType(name.endsWith(".pdf") ? "application/pdf"
                : name.endsWith(".csv") ? "text/csv" : "application/zip");
        resource.setSizeBytes((long) content.length);
        resource.setStorageKey(storage.store(content));
        resources.saveAndFlush(resource);
    }

    private byte[] bytes(String name) {
        try (var input = new ClassPathResource("project/hierarchy-demo/" + name).getInputStream()) {
            return input.readAllBytes();
        } catch (IOException exception) {
            throw new UncheckedIOException("Unable to read hierarchy demo asset " + name, exception);
        }
    }
}
