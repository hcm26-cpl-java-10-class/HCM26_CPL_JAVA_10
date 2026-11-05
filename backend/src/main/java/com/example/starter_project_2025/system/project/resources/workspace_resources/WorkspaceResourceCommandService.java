package com.example.starter_project_2025.system.project.resources.workspace_resources;

import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.resources.ResourceKind;
import com.example.starter_project_2025.system.project.resources.TemplateResourceFileStorage;
import com.example.starter_project_2025.system.project.resources.TemplateResourceFileStorage.StoredTemplateFile;
import com.example.starter_project_2025.system.project.resources.project_resource_audits.ProjectResourceAuditService;
import com.example.starter_project_2025.system.project.resources.project_resource_files.ProjectResourceFile;
import com.example.starter_project_2025.system.project.resources.project_resource_files.ProjectResourceFileRepository;
import com.example.starter_project_2025.system.project.resources.project_resources.ProjectResource;
import com.example.starter_project_2025.system.project.resources.project_resources.ProjectResourceRepository;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceContextService;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceProjectScope;
import org.springframework.security.access.AccessDeniedException;
import com.example.starter_project_2025.system.rbac.user.User;
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
import java.util.Objects;

/**
 * Write use case of the workspace Resources tab (US-RES-003).
 * <p>
 * Business rules:
 * <ul>
 *     <li>only the team mentor or an admin / program manager may mutate the
 *     list ({@link WorkspaceResourceEditorPolicy})</li>
 *     <li>every mutation touches {@code project_resources} of the workspace
 *     project only — the source template and other teams are never changed</li>
 *     <li>{@code updated_by} / {@code updated_at} are maintained by the JPA
 *     auditing listener; every change additionally writes an audit row</li>
 *     <li>deleting is a soft delete ({@code is_active = false}) so the audit
 *     trail keeps pointing at a real row</li>
 * </ul>
 */
@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class WorkspaceResourceCommandService {

    static final int MAX_RESOURCES_PER_PROJECT = 100;
    static final int MAX_TITLE_LENGTH = 255;
    static final int MAX_DESCRIPTION_LENGTH = 1000;
    static final int MAX_URL_LENGTH = 1000;
    static final int MAX_CATEGORY_LENGTH = 50;

    static final String ACTION_CREATE = "RESOURCE_CREATE";
    static final String ACTION_UPDATE = "RESOURCE_UPDATE";
    static final String ACTION_DELETE = "RESOURCE_DELETE";
    static final String ACTION_FILE_UPLOAD = "RESOURCE_FILE_UPLOAD";
    static final String ACTION_FILE_DELETE = "RESOURCE_FILE_DELETE";

    WorkspaceAccessService access;
    WorkspaceContextService contexts;
    WorkspaceProjectScope scope;
    WorkspaceResourceEditorPolicy editorPolicy;
    ProjectResourceRepository resources;
    ProjectResourceFileRepository files;
    TemplateResourceFileStorage storage;
    ProjectResourceAuditService audits;

    // ---------------------------------------------------------------------
    // Resource create / update / delete
    // ---------------------------------------------------------------------

    public WorkspaceResourceDtos.ResourceItem create(Long workspaceId, Long projectId,
                                                     WorkspaceResourceDtos.ResourcePayload request) {

        User user = access.requireUser(false);
        Workspace workspace = contexts.require(user, workspaceId);
        Long targetId = projectId == null && workspace.getProject() != null ? workspace.getProject().getId() : projectId;
        Project project = requireEditableProject(user, workspace, targetId);

        if (resources.countByProjectId(project.getId()) >= MAX_RESOURCES_PER_PROJECT) {
            throw validation("resources",
                    "A workspace can hold at most " + MAX_RESOURCES_PER_PROJECT + " resources");
        }

        ProjectResource entity = new ProjectResource();
        entity.setProjectId(project.getId());
        entity.setTenantId(project.getTenantId());
        entity.setIsActive(true);
        entity.setOrderIndex((int) resources.countByProjectId(project.getId()));

        apply(entity, request);

        ProjectResource saved = resources.saveAndFlush(entity);
        WorkspaceResourceDtos.ResourceItem view = view(saved);

        audits.record(ACTION_CREATE, project.getId(), saved.getId(), null, view);

        return view;
    }

    public WorkspaceResourceDtos.ResourceItem update(Long workspaceId,
                                                     Long resourceId,
                                                     WorkspaceResourceDtos.ResourcePayload request) {

        ProjectResource entity = requireEditableResource(workspaceId, resourceId);
        WorkspaceResourceDtos.ResourceItem before = view(entity);

        apply(entity, request);

        ProjectResource saved = resources.saveAndFlush(entity);
        WorkspaceResourceDtos.ResourceItem after = view(saved);

        audits.record(ACTION_UPDATE, entity.getProjectId(), saved.getId(), before, after);

        return after;
    }

    public void delete(Long workspaceId, Long resourceId) {

        ProjectResource entity = requireEditableResource(workspaceId, resourceId);
        WorkspaceResourceDtos.ResourceItem before = view(entity);

        entity.setIsActive(false);
        resources.saveAndFlush(entity);

        for (ProjectResourceFile file : files.findAllByResourceIdOrderByIdAsc(resourceId)) {
            if (Boolean.TRUE.equals(file.getIsActive())) {
                file.setIsActive(false);
                files.save(file);
            }
        }
        files.flush();

        audits.record(ACTION_DELETE, entity.getProjectId(), resourceId, before, null);
    }

    // ---------------------------------------------------------------------
    // File upload / delete
    // ---------------------------------------------------------------------

    public WorkspaceResourceDtos.FileItem upload(Long workspaceId,
                                                 Long resourceId,
                                                 MultipartFile file) {

        ProjectResource resource = requireEditableResource(workspaceId, resourceId);

        StoredTemplateFile stored = storage.store(file);

        ProjectResourceFile entity = new ProjectResourceFile();
        entity.setResourceId(resource.getId());
        entity.setStorageKey(stored.storageKey());
        entity.setOriginalName(stored.originalName());
        entity.setContentType(stored.contentType());
        entity.setSizeBytes(stored.sizeBytes());
        entity.setIsActive(true);

        ProjectResourceFile saved = files.saveAndFlush(entity);
        WorkspaceResourceDtos.FileItem view = fileView(saved);

        audits.record(ACTION_FILE_UPLOAD, resource.getProjectId(), resource.getId(), null, view);

        return view;
    }

    public void deleteFile(Long workspaceId, Long resourceId, Long fileId) {

        ProjectResource resource = requireEditableResource(workspaceId, resourceId);

        ProjectResourceFile file = files.findById(fileId)
                .filter(value -> Boolean.TRUE.equals(value.getIsActive()))
                .filter(value -> Objects.equals(value.getResourceId(), resource.getId()))
                .orElseThrow(WorkspaceResourceCommandService::notFound);

        WorkspaceResourceDtos.FileItem before = fileView(file);

        file.setIsActive(false);
        files.saveAndFlush(file);

        audits.record(ACTION_FILE_DELETE, resource.getProjectId(), resource.getId(), before, null);
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    private Project requireEditableProject(User user, Workspace workspace, Long projectId) {
        if (projectId == null) throw new ResourceNotFoundException("This workspace has no project to hold resources");
        Project project = scope.projects(workspace).stream()
                .filter(value -> projectId.equals(value.getId())
                        && Objects.equals(value.getTenantId(), workspace.getTenant().getId()))
                .findFirst().orElseThrow(() -> new AccessDeniedException("The resource is outside this workspace"));
        editorPolicy.requireManage(user, workspace, project);
        return project;
    }

    private ProjectResource requireEditableResource(Long workspaceId, Long resourceId) {
        User user = access.requireUser(false);
        Workspace workspace = contexts.require(user, workspaceId);
        ProjectResource resource = resources.findById(resourceId)
                .filter(value -> Boolean.TRUE.equals(value.getIsActive()))
                .orElseThrow(WorkspaceResourceCommandService::notFound);
        if (!Objects.equals(resource.getTenantId(), workspace.getTenant().getId())) {
            throw new AccessDeniedException("The resource is outside this workspace");
        }
        requireEditableProject(user, workspace, resource.getProjectId());
        return resource;
    }

    private void apply(ProjectResource entity, WorkspaceResourceDtos.ResourcePayload request) {

        WorkspaceResourceDtos.ResourcePayload safe = request == null
                ? new WorkspaceResourceDtos.ResourcePayload(null, null, null, null, null, null)
                : request;

        Map<String, List<String>> errors = new LinkedHashMap<>();

        String title = trim(safe.title());
        String description = trim(safe.description());
        ResourceKind kind = parseKind(safe.kind(), errors);
        String url = trim(safe.url());
        String category = trim(safe.category());
        Integer orderIndex = safe.orderIndex() == null ? entity.getOrderIndex() : safe.orderIndex();

        if (orderIndex == null || orderIndex < 0) {
            orderIndex = 0;
        }

        if (title == null || title.isBlank()) {
            add(errors, "title", "Title is required");
        } else if (title.length() > MAX_TITLE_LENGTH) {
            add(errors, "title", "Title must not exceed " + MAX_TITLE_LENGTH + " characters");
        }

        if (description != null && description.length() > MAX_DESCRIPTION_LENGTH) {
            add(errors, "description",
                    "Description must not exceed " + MAX_DESCRIPTION_LENGTH + " characters");
        }

        if (kind == ResourceKind.LINK && (url == null || url.isBlank())) {
            add(errors, "url", "Url is required for a LINK resource");
        }

        if (url != null && url.length() > MAX_URL_LENGTH) {
            add(errors, "url", "Url must not exceed " + MAX_URL_LENGTH + " characters");
        }

        if (category != null && category.length() > MAX_CATEGORY_LENGTH) {
            add(errors, "category", "Category must not exceed " + MAX_CATEGORY_LENGTH + " characters");
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

    private WorkspaceResourceDtos.ResourceItem view(ProjectResource resource) {

        List<WorkspaceResourceDtos.FileItem> attached = files
                .findAllByResourceIdOrderByIdAsc(resource.getId())
                .stream()
                .filter(file -> Boolean.TRUE.equals(file.getIsActive()))
                .map(this::fileView)
                .toList();

        return new WorkspaceResourceDtos.ResourceItem(resource.getId(), resource.getTitle(),
                resource.getDescription(), resource.getKind() == null ? null : resource.getKind().name(),
                resource.getUrl(), resource.getCategory(), resource.getOrderIndex(),
                resource.getUpdatedAt(), resource.getUpdatedBy(), attached, resource.getSourceTemplateId(),
                resource.getSourceTemplateName(), resource.getSourceOrigin(), resource.getProjectId(), true);
    }

    private WorkspaceResourceDtos.FileItem fileView(ProjectResourceFile file) {
        return new WorkspaceResourceDtos.FileItem(file.getId(), file.getOriginalName(),
                file.getContentType(), file.getSizeBytes());
    }

    private static ResourceKind parseKind(String value, Map<String, List<String>> errors) {

        if (value == null || value.isBlank()) {
            return ResourceKind.LINK;
        }

        try {
            return ResourceKind.valueOf(value.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            add(errors, "kind", "Kind must be FILE or LINK");
            return ResourceKind.LINK;
        }
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }

    private static void add(Map<String, List<String>> errors, String field, String message) {
        errors.computeIfAbsent(field, key -> new ArrayList<>()).add(message);
    }

    private static BusinessValidationException validation(String field, String message) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        errors.put(field, List.of(message));
        return new BusinessValidationException(errors);
    }

    private static ResourceNotFoundException notFound() {
        return new ResourceNotFoundException("Resource or file was not found");
    }

}
