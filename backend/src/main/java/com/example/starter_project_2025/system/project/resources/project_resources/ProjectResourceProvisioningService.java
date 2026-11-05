package com.example.starter_project_2025.system.project.resources.project_resources;

import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.resources.ResourceKind;
import com.example.starter_project_2025.system.project.resources.project_resource_files.ProjectResourceFile;
import com.example.starter_project_2025.system.project.resources.project_resource_files.ProjectResourceFileRepository;
import com.example.starter_project_2025.system.project.resources.template_resource_files.TemplateResourceFileRepository;
import com.example.starter_project_2025.system.project.resources.template_resources.TemplateResourceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(propagation = Propagation.MANDATORY)
public class ProjectResourceProvisioningService {
    public record Attachment(String storageKey, String fileName, String contentType, Long sizeBytes) { }

    public record Resource(Long id, String title, String description, ResourceKind kind, String url,
                           String category, Integer orderIndex, List<Attachment> attachments) { }

    public record Source(Long templateId, Long versionId, String name, String origin, List<Resource> resources) { }

    private final TemplateResourceRepository templateResources;
    private final TemplateResourceFileRepository templateFiles;
    private final ProjectResourceRepository projectResources;
    private final ProjectResourceFileRepository projectFiles;

    public Source capture(Long templateId, Long versionId, String name, String origin) {
        List<Resource> resources = versionId == null ? List.of() :
                templateResources.findAllByTemplateVersionIdOrderByOrderIndexAscIdAsc(versionId).stream()
                        .filter(item -> Boolean.TRUE.equals(item.getIsActive()) && templateId.equals(item.getTemplateId()))
                        .map(item -> new Resource(item.getId(), item.getTitle(), item.getDescription(), item.getKind(),
                                item.getUrl(), item.getCategory(), item.getOrderIndex(), templateFiles
                                .findAllByResourceIdOrderByIdAsc(item.getId()).stream()
                                .filter(file -> Boolean.TRUE.equals(file.getIsActive()))
                                .map(file -> new Attachment(file.getStorageKey(), file.getOriginalName(),
                                        file.getContentType(), file.getSizeBytes())).toList())).toList();
        return new Source(templateId, versionId, name, origin, resources);
    }

    public int provision(Project project, Source source) {
        List<ProjectResourceFile> attachments = new ArrayList<>();
        List<ProjectResource> rows = source.resources().stream().map(item -> {
            ProjectResource row = new ProjectResource();
            row.setProjectId(project.getId());
            row.setTenantId(project.getTenantId());
            row.setTitle(item.title());
            row.setDescription(item.description());
            row.setKind(item.kind());
            row.setUrl(item.url());
            row.setCategory(item.category());
            row.setOrderIndex(item.orderIndex());
            row.setSourceTemplateSnapshotId(source.versionId());
            row.setSourceTemplateResourceId(item.id());
            row.setSourceTemplateId(source.templateId());
            row.setSourceTemplateName(source.name());
            row.setSourceOrigin(source.origin());
            row.setIsActive(true);
            return row;
        }).toList();
        List<ProjectResource> saved = projectResources.saveAll(rows);
        for (int index = 0; index < saved.size(); index++) {
            for (Attachment attachment : source.resources().get(index).attachments()) {
                ProjectResourceFile file = new ProjectResourceFile();
                file.setResourceId(saved.get(index).getId());
                file.setStorageKey(attachment.storageKey());
                file.setOriginalName(attachment.fileName());
                file.setContentType(attachment.contentType());
                file.setSizeBytes(attachment.sizeBytes());
                file.setIsActive(true);
                attachments.add(file);
            }
        }
        projectFiles.saveAll(attachments);
        return saved.size();
    }
}
