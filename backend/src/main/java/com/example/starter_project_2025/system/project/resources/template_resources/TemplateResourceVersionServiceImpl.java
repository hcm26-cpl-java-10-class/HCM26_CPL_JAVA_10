package com.example.starter_project_2025.system.project.resources.template_resources;

import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateVersionStatus;
import com.example.starter_project_2025.system.project.project_template_version.audit.ProjectTemplateSnapshotAuditService;
import com.example.starter_project_2025.system.project.resources.ResourceKind;
import com.example.starter_project_2025.system.project.resources.TemplateResourceFileStorage;
import com.example.starter_project_2025.system.project.resources.TemplateResourceFileStorage.StoredTemplateFile;
import com.example.starter_project_2025.system.project.resources.template_resource_files.TemplateResourceFile;
import com.example.starter_project_2025.system.project.resources.template_resource_files.TemplateResourceFileRepository;
import com.example.starter_project_2025.system.project.template.ProjectTemplateException;
import com.example.starter_project_2025.system.project.template.ProjectTemplateStatus;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Resources attached to one template <em>version</em> (US-RES-001).
 * <p>
 * Business rules:
 * <ul>
 *     <li>a resource belongs to exactly one version, so publishing a version
 *     freezes the list and later edits only affect versions still in
 *     {@code DRAFT}</li>
 *     <li>editing is only allowed on a draft version of a template that is not
 *     archived; published/archived versions stay read-only (AC02)</li>
 *     <li>files are validated by {@link TemplateResourceFileStorage}: 25 MB by
 *     default, executables/scripts rejected (AC03)</li>
 *     <li>every create / update / delete / upload is written to the version
 *     audit trail (business rule 4)</li>
 * </ul>
 */
@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class TemplateResourceVersionServiceImpl implements TemplateResourceVersionService {

    static final int MAX_RESOURCES_PER_VERSION = 50;
    static final int MAX_TITLE_LENGTH = 255;
    static final int MAX_DESCRIPTION_LENGTH = 1000;
    static final int MAX_URL_LENGTH = 1000;
    static final int MAX_CATEGORY_LENGTH = 50;

    static final String ACTION_CREATE = "RESOURCE_CREATE";
    static final String ACTION_UPDATE = "RESOURCE_UPDATE";
    static final String ACTION_DELETE = "RESOURCE_DELETE";
    static final String ACTION_FILE_UPLOAD = "RESOURCE_FILE_UPLOAD";
    static final String ACTION_FILE_DELETE = "RESOURCE_FILE_DELETE";

    ProjectTemplateSnapshotRepository versionRepository;
    ProjectTemplateRepository templateRepository;
    TemplateResourceRepository templateResourceRepository;
    TemplateResourceFileRepository templateResourceFileRepository;
    TemplateResourceFileStorage fileStorage;
    ProjectTemplateSnapshotAuditService audits;

    // ---------------------------------------------------------------------
    // Query
    // ---------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public TemplateResourceCollection getByVersion(Long versionId) {

        ProjectTemplateSnapshot version = requireVersion(versionId);

        List<TemplateResourceView> items = templateResourceRepository
                .findAllByTemplateVersionIdOrderByOrderIndexAscIdAsc(versionId)
                .stream()
                .map(resource -> view(resource))
                .toList();

        return new TemplateResourceCollection(items, fileStorage.maxBytes(),
                fileStorage.allowedExtensions(), isEditable(version));
    }

    // ---------------------------------------------------------------------
    // Create
    // ---------------------------------------------------------------------

    @Override
    public TemplateResourceView create(Long versionId, TemplateResourceRequest request) {

        ProjectTemplateSnapshot version = requireEditableVersion(versionId);

        if (templateResourceRepository.countByTemplateVersionId(versionId) >= MAX_RESOURCES_PER_VERSION) {
            throw new BusinessValidationException(Map.of("resources",
                    List.of("A template version can hold at most " + MAX_RESOURCES_PER_VERSION + " resources")));
        }

        ProjectTemplate template = requireTemplate(version.getTemplateId());

        TemplateResource entity = new TemplateResource();
        entity.setTemplateId(version.getTemplateId());
        entity.setTemplateVersionId(versionId);
        entity.setTenantId(template.getTenantId());
        entity.setIsActive(true);
        entity.setOrderIndex((int) templateResourceRepository.countByTemplateVersionId(versionId));

        apply(entity, request);

        TemplateResource saved = templateResourceRepository.save(entity);
        TemplateResourceView savedView = view(saved);

        audits.record(ACTION_CREATE, versionId, version.getTemplateId(), null, null, savedView);

        return savedView;
    }

    // ---------------------------------------------------------------------
    // Update
    // ---------------------------------------------------------------------

    @Override
    public TemplateResourceView update(Long versionId, Long resourceId, TemplateResourceRequest request) {

        ProjectTemplateSnapshot version = requireEditableVersion(versionId);
        TemplateResource entity = requireResource(versionId, resourceId);
        TemplateResourceView before = view(entity);

        apply(entity, request);

        TemplateResource saved = templateResourceRepository.save(entity);
        TemplateResourceView after = view(saved);

        audits.record(ACTION_UPDATE, versionId, version.getTemplateId(), null, before, after);

        return after;
    }

    // ---------------------------------------------------------------------
    // Delete
    // ---------------------------------------------------------------------

    @Override
    public void delete(Long versionId, Long resourceId) {

        ProjectTemplateSnapshot version = requireEditableVersion(versionId);
        TemplateResource entity = requireResource(versionId, resourceId);
        TemplateResourceView before = view(entity);

        for (TemplateResourceFile file : templateResourceFileRepository.findAllByResourceIdOrderByIdAsc(resourceId)) {
            fileStorage.delete(file.getStorageKey());
        }

        templateResourceFileRepository.deleteByResourceId(resourceId);
        templateResourceRepository.delete(entity);

        audits.record(ACTION_DELETE, versionId, version.getTemplateId(), null, before, null);
    }

    // ---------------------------------------------------------------------
    // Files
    // ---------------------------------------------------------------------

    @Override
    public TemplateResourceFileView upload(Long versionId, Long resourceId, MultipartFile file) {

        ProjectTemplateSnapshot version = requireEditableVersion(versionId);
        TemplateResource resource = requireResource(versionId, resourceId);

        StoredTemplateFile stored = fileStorage.store(file);

        TemplateResourceFile entity = new TemplateResourceFile();
        entity.setResourceId(resource.getId());
        entity.setStorageKey(stored.storageKey());
        entity.setOriginalName(stored.originalName());
        entity.setContentType(stored.contentType());
        entity.setSizeBytes(stored.sizeBytes());
        entity.setIsActive(true);

        TemplateResourceFile saved = templateResourceFileRepository.save(entity);
        TemplateResourceFileView view = fileView(versionId, saved);

        audits.record(ACTION_FILE_UPLOAD, versionId, version.getTemplateId(), null, null, view);

        return view;
    }

    @Override
    @Transactional(readOnly = true)
    public TemplateResourceDownload download(Long versionId, Long fileId) {

        requireVersion(versionId);

        TemplateResourceFile file = templateResourceFileRepository.findById(fileId)
                .orElseThrow(() -> new ResourceNotFoundException("Resource file was not found"));

        TemplateResource resource = templateResourceRepository.findById(file.getResourceId())
                .orElseThrow(() -> new ResourceNotFoundException("Resource file was not found"));

        if (!versionId.equals(resource.getTemplateVersionId())) {
            throw new ResourceNotFoundException("Resource file was not found");
        }

        return new TemplateResourceDownload(file.getOriginalName(), file.getContentType(),
                fileStorage.read(file.getStorageKey()));
    }

    @Override
    public void deleteFile(Long versionId, Long fileId) {

        ProjectTemplateSnapshot version = requireEditableVersion(versionId);

        TemplateResourceFile file = templateResourceFileRepository.findById(fileId)
                .orElseThrow(() -> new ResourceNotFoundException("Resource file was not found"));

        TemplateResource resource = templateResourceRepository.findById(file.getResourceId())
                .orElseThrow(() -> new ResourceNotFoundException("Resource file was not found"));

        if (!versionId.equals(resource.getTemplateVersionId())) {
            throw new ResourceNotFoundException("Resource file was not found");
        }

        TemplateResourceFileView before = fileView(versionId, file);

        templateResourceFileRepository.delete(file);
        fileStorage.delete(file.getStorageKey());

        audits.record(ACTION_FILE_DELETE, versionId, version.getTemplateId(), null, before, null);
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    private ProjectTemplateSnapshot requireVersion(Long versionId) {

        ProjectTemplateSnapshot version = versionRepository.findById(versionId)
                .orElseThrow(() -> new ResourceNotFoundException("Template version was not found"));

        if (version.getProjectId() != null) {
            throw new ResourceNotFoundException("Template version was not found");
        }

        return version;
    }

    private ProjectTemplateSnapshot requireEditableVersion(Long versionId) {

        ProjectTemplateSnapshot version = requireVersion(versionId);
        ProjectTemplate template = requireTemplate(version.getTemplateId());

        if (version.getStatus() != ProjectTemplateVersionStatus.DRAFT
                || !Boolean.TRUE.equals(version.getIsActive())
                || template.getStatus() == ProjectTemplateStatus.ARCHIVED) {
            throw ProjectTemplateException.conflict(
                    "Only a draft version of an editable template can change its resources. Create a new version instead.");
        }

        return version;
    }

    private ProjectTemplate requireTemplate(Long templateId) {

        return templateRepository.findById(templateId)
                .orElseThrow(() -> new ResourceNotFoundException("Project template was not found"));
    }

    private TemplateResource requireResource(Long versionId, Long resourceId) {

        TemplateResource resource = templateResourceRepository.findById(resourceId)
                .orElseThrow(() -> new ResourceNotFoundException("Template resource was not found"));

        if (!versionId.equals(resource.getTemplateVersionId())) {
            throw new ResourceNotFoundException("Template resource was not found");
        }

        return resource;
    }

    private boolean isEditable(ProjectTemplateSnapshot version) {

        ProjectTemplate template = templateRepository.findById(version.getTemplateId()).orElse(null);

        return template != null
                && version.getStatus() == ProjectTemplateVersionStatus.DRAFT
                && Boolean.TRUE.equals(version.getIsActive())
                && template.getStatus() != ProjectTemplateStatus.ARCHIVED;
    }

    private void apply(TemplateResource entity, TemplateResourceRequest request) {

        Map<String, List<String>> errors = new LinkedHashMap<>();

        String title = trim(request.title());
        String description = trim(request.description());
        ResourceKind kind = request.kind() == null ? ResourceKind.LINK : request.kind();
        String url = trim(request.url());
        String category = trim(request.category());
        Integer orderIndex = request.orderIndex() == null ? entity.getOrderIndex() : request.orderIndex();
        if (orderIndex == null || orderIndex < 0) {
            orderIndex = 0;
        }

        if (title == null || title.isBlank()) {
            errors.computeIfAbsent("title", key -> new ArrayList<>()).add("Title is required");
        } else if (title.length() > MAX_TITLE_LENGTH) {
            errors.computeIfAbsent("title", key -> new ArrayList<>())
                    .add("Title must not exceed " + MAX_TITLE_LENGTH + " characters");
        }

        if (description != null && description.length() > MAX_DESCRIPTION_LENGTH) {
            errors.computeIfAbsent("description", key -> new ArrayList<>())
                    .add("Description must not exceed " + MAX_DESCRIPTION_LENGTH + " characters");
        }

        if (kind == ResourceKind.LINK && (url == null || url.isBlank())) {
            errors.computeIfAbsent("url", key -> new ArrayList<>())
                    .add("Url is required for a LINK resource");
        }

        if (url != null && url.length() > MAX_URL_LENGTH) {
            errors.computeIfAbsent("url", key -> new ArrayList<>())
                    .add("Url must not exceed " + MAX_URL_LENGTH + " characters");
        }

        if (category != null && category.length() > MAX_CATEGORY_LENGTH) {
            errors.computeIfAbsent("category", key -> new ArrayList<>())
                    .add("Category must not exceed " + MAX_CATEGORY_LENGTH + " characters");
        }

        if (!errors.isEmpty()) {
            throw new BusinessValidationException(errors);
        }

        entity.setTitle(title);
        entity.setDescription(description);
        entity.setKind(kind);
        entity.setUrl(url);
        entity.setCategory(category);
        entity.setOrderIndex(orderIndex);
    }

    private TemplateResourceView view(TemplateResource resource) {

        Long versionId = resource.getTemplateVersionId();

        List<TemplateResourceFileView> files = templateResourceFileRepository
                .findAllByResourceIdOrderByIdAsc(resource.getId())
                .stream()
                .map(file -> fileView(versionId, file))
                .toList();

        return new TemplateResourceView(resource.getId(), resource.getTemplateId(), versionId,
                resource.getTitle(), resource.getDescription(), resource.getKind(), resource.getUrl(),
                resource.getCategory(), resource.getOrderIndex(), files);
    }

    private TemplateResourceFileView fileView(Long versionId, TemplateResourceFile file) {

        String downloadPath = "/project-template-versions/" + versionId
                + "/resources/files/" + file.getId() + "/download";

        return new TemplateResourceFileView(file.getId(), file.getOriginalName(), file.getContentType(),
                file.getSizeBytes(), downloadPath);
    }

    private String trim(String value) {
        return value == null ? null : value.trim();
    }
}
