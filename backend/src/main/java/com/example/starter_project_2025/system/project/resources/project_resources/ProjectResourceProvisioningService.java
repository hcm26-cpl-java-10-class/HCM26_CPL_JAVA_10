package com.example.starter_project_2025.system.project.resources.project_resources;

import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot;
import com.example.starter_project_2025.system.project.resources.project_resource_files.ProjectResourceFile;
import com.example.starter_project_2025.system.project.resources.project_resource_files.ProjectResourceFileRepository;
import com.example.starter_project_2025.system.project.resources.template_resource_files.TemplateResourceFile;
import com.example.starter_project_2025.system.project.resources.template_resource_files.TemplateResourceFileRepository;
import com.example.starter_project_2025.system.project.resources.template_resources.TemplateResource;
import com.example.starter_project_2025.system.project.resources.template_resources.TemplateResourceRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Copies the resource list of the assigned template version into a project
 * (US-RES-001).
 * <p>
 * The project rows are independent copies: they keep the provenance
 * ({@code source_template_snapshot_id} / {@code source_template_resource_id})
 * but are never read from the template. Editing or deleting a template
 * resource therefore never changes an already assigned project (AC02).
 * <p>
 * File bytes are shared through the same {@code storage_key}; only the
 * metadata row is duplicated.
 */
@Slf4j
@Service
@Transactional(propagation = Propagation.MANDATORY)
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ProjectResourceProvisioningService {

    TemplateResourceRepository templateResourceRepository;
    TemplateResourceFileRepository templateResourceFileRepository;
    ProjectResourceRepository projectResourceRepository;
    ProjectResourceFileRepository projectResourceFileRepository;

    /**
     * @param assignedSnapshot snapshot created for this assignment; its
     *                         {@code parentTemplateId} points at the source
     *                         version holding the resources
     * @return number of resources copied into the project
     */
    public int provision(ProjectTemplateSnapshot assignedSnapshot, Long projectId, Long tenantId) {

        if (assignedSnapshot == null || projectId == null) {
            return 0;
        }

        Long sourceVersionId = assignedSnapshot.getParentTemplateId();

        if (sourceVersionId == null) {
            log.debug("Assignment snapshot {} has no source version - no resources to inherit",
                    assignedSnapshot.getId());
            return 0;
        }

        int copied = 0;

        for (TemplateResource source : templateResourceRepository
                .findAllByTemplateVersionIdOrderByOrderIndexAscIdAsc(sourceVersionId)) {

            ProjectResource projectResource = new ProjectResource();
            projectResource.setProjectId(projectId);
            projectResource.setTenantId(tenantId);
            projectResource.setTitle(source.getTitle());
            projectResource.setDescription(source.getDescription());
            projectResource.setKind(source.getKind());
            projectResource.setUrl(source.getUrl());
            projectResource.setCategory(source.getCategory());
            projectResource.setOrderIndex(source.getOrderIndex());
            projectResource.setSourceTemplateSnapshotId(sourceVersionId);
            projectResource.setSourceTemplateResourceId(source.getId());
            projectResource.setIsActive(Boolean.TRUE);

            ProjectResource savedResource = projectResourceRepository.save(projectResource);

            for (TemplateResourceFile file : templateResourceFileRepository
                    .findAllByResourceIdOrderByIdAsc(source.getId())) {

                ProjectResourceFile projectFile = new ProjectResourceFile();
                projectFile.setResourceId(savedResource.getId());
                projectFile.setStorageKey(file.getStorageKey());
                projectFile.setOriginalName(file.getOriginalName());
                projectFile.setContentType(file.getContentType());
                projectFile.setSizeBytes(file.getSizeBytes());
                projectFile.setIsActive(Boolean.TRUE);

                projectResourceFileRepository.save(projectFile);
            }

            copied++;
        }

        log.info("Inherited {} template resources (version {}) into project {}", copied, sourceVersionId, projectId);

        return copied;
    }
}
