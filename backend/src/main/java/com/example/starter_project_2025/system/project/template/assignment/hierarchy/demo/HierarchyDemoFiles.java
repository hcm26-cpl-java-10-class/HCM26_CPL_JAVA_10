package com.example.starter_project_2025.system.project.template.assignment.hierarchy.demo;

import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateVersionStatus;
import com.example.starter_project_2025.system.project.resources.ResourceKind;
import com.example.starter_project_2025.system.project.resources.TemplateResourceFileStorage;
import com.example.starter_project_2025.system.project.resources.template_resource_files.TemplateResourceFile;
import com.example.starter_project_2025.system.project.resources.template_resource_files.TemplateResourceFileRepository;
import com.example.starter_project_2025.system.project.resources.template_resources.TemplateResource;
import com.example.starter_project_2025.system.project.resources.template_resources.TemplateResourceRepository;
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
    private final ProjectTemplateSnapshotRepository versions;
    private final TemplateResourceFileRepository files;
    private final TemplateResourceFileStorage storage;
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
        var draft = versions.findFirstByTemplateIdAndStatusAndIsActiveTrueOrderByCreatedAtDesc(
                template.getId(), ProjectTemplateVersionStatus.DRAFT).orElseThrow();
        var stored = storage.storeBytes(bytes(name), name);
        TemplateResource resource = new TemplateResource();
        resource.setTemplateId(template.getId());
        resource.setTemplateVersionId(draft.getId());
        resource.setTenantId(template.getTenantId());
        resource.setKind(ResourceKind.FILE);
        resource.setTitle(name);
        resource.setOrderIndex((int) resources.countByTemplateVersionId(draft.getId()));
        resources.saveAndFlush(resource);

        TemplateResourceFile file = new TemplateResourceFile();
        file.setResourceId(resource.getId());
        file.setOriginalName(stored.originalName());
        file.setContentType(stored.contentType());
        file.setSizeBytes(stored.sizeBytes());
        file.setStorageKey(stored.storageKey());
        files.saveAndFlush(file);
    }

    private byte[] bytes(String name) {
        try (var input = new ClassPathResource("project/hierarchy-demo/" + name).getInputStream()) {
            return input.readAllBytes();
        } catch (IOException exception) {
            throw new UncheckedIOException("Unable to read hierarchy demo asset " + name, exception);
        }
    }
}
