package com.example.starter_project_2025.system.project.resources.template_resources;

import org.springframework.web.multipart.MultipartFile;

/**
 * Version-scoped resource management used by the Resources tab of a Project
 * Template version (US-RES-001).
 */
public interface TemplateResourceVersionService {

    /** Resources of one version + upload policy + whether the version is editable. */
    TemplateResourceCollection getByVersion(Long versionId);

    TemplateResourceView create(Long versionId, TemplateResourceRequest request);

    TemplateResourceView update(Long versionId, Long resourceId, TemplateResourceRequest request);

    void delete(Long versionId, Long resourceId);

    TemplateResourceFileView upload(Long versionId, Long resourceId, MultipartFile file);

    TemplateResourceDownload download(Long versionId, Long fileId);

    void deleteFile(Long versionId, Long fileId);
}
