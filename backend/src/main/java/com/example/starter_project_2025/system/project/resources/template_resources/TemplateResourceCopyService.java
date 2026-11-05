package com.example.starter_project_2025.system.project.resources.template_resources;

import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.resources.template_resource_files.TemplateResourceFile;
import com.example.starter_project_2025.system.project.resources.template_resource_files.TemplateResourceFileRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Copies the resource list of a template version onto a new version.
 * <p>
 * Used when a new version is created from an existing one and when a template
 * is duplicated, so the new draft starts from the same resource set. The file
 * bytes are shared: only the metadata row is cloned, pointed at the very same
 * {@code storageKey}.
 */
@Service
@Transactional(propagation = Propagation.MANDATORY)
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class TemplateResourceCopyService {

    TemplateResourceRepository templateResourceRepository;
    TemplateResourceFileRepository templateResourceFileRepository;
    ProjectTemplateRepository projectTemplateRepository;

    /**
     * @param sourceVersionId version whose resources are cloned (may be null,
     *                        in which case nothing happens)
     * @param targetVersionId version that receives the copies
     * @param targetTemplateId owning template of the target version
     */
    public void copy(Long sourceVersionId, Long targetVersionId, Long targetTemplateId) {

        if (sourceVersionId == null || targetVersionId == null || targetTemplateId == null) {
            return;
        }

        Long tenantId = projectTemplateRepository.findById(targetTemplateId)
                .map(template -> template.getTenantId())
                .orElse(null);

        for (TemplateResource source : templateResourceRepository
                .findAllByTemplateVersionIdOrderByOrderIndexAscIdAsc(sourceVersionId)) {

            TemplateResource copy = new TemplateResource();
            copy.setTemplateId(targetTemplateId);
            copy.setTemplateVersionId(targetVersionId);
            copy.setTenantId(tenantId);
            copy.setTitle(source.getTitle());
            copy.setDescription(source.getDescription());
            copy.setKind(source.getKind());
            copy.setUrl(source.getUrl());
            copy.setCategory(source.getCategory());
            copy.setOrderIndex(source.getOrderIndex());
            copy.setIsActive(source.getIsActive() == null ? Boolean.TRUE : source.getIsActive());

            TemplateResource savedCopy = templateResourceRepository.save(copy);

            for (TemplateResourceFile file : templateResourceFileRepository
                    .findAllByResourceIdOrderByIdAsc(source.getId())) {

                TemplateResourceFile fileCopy = new TemplateResourceFile();
                fileCopy.setResourceId(savedCopy.getId());
                fileCopy.setStorageKey(file.getStorageKey());
                fileCopy.setOriginalName(file.getOriginalName());
                fileCopy.setContentType(file.getContentType());
                fileCopy.setSizeBytes(file.getSizeBytes());
                fileCopy.setIsActive(Boolean.TRUE);

                templateResourceFileRepository.save(fileCopy);
            }
        }
    }
}
