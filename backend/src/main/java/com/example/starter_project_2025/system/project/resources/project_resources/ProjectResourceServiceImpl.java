package com.example.starter_project_2025.system.project.resources.project_resources;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.resources.ProjectResourceAccessGuard;
import com.example.starter_project_2025.system.project.resources.ResourceKind;
import com.example.starter_project_2025.system.project.resources.project_resource_files.ProjectResourceFileRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

/**
 * CRUD use case of {@link ProjectResource}.
 * <p>
 * Business rules:
 * <ul>
 *     <li>{@code projectId} is mandatory and must reference an existing project;
 *     the owning {@code tenantId} is always derived from that project</li>
 *     <li>{@code title} is mandatory (1..255) and every text field is trimmed</li>
 *     <li>{@code url} is mandatory when {@code kind == LINK}</li>
 *     <li>deleting a resource also removes its stored file rows</li>
 * </ul>
 */
@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ProjectResourceServiceImpl
        extends BaseCrudServiceImpl<ProjectResource, Long, ProjectResourceDTO, ProjectResourceFilter>
        implements ProjectResourceService {

    static final int MAX_TITLE_LENGTH = 255;
    static final int MAX_DESCRIPTION_LENGTH = 1000;
    static final int MAX_URL_LENGTH = 1000;
    static final int MAX_CATEGORY_LENGTH = 50;

    static final String TITLE_FIELD = "title";
    static final String DESCRIPTION_FIELD = "description";
    static final String KIND_FIELD = "kind";
    static final String URL_FIELD = "url";
    static final String CATEGORY_FIELD = "category";
    static final String ORDER_INDEX_FIELD = "orderIndex";
    static final String PROJECT_ID_FIELD = "projectId";

    ProjectResourceMapper projectResourceMapper;
    ProjectResourceRepository projectResourceRepository;
    ProjectRepository projectRepository;
    ProjectResourceFileRepository projectResourceFileRepository;
    ProjectResourceAccessGuard resourceAccessGuard;

    @Override
    protected BaseCrudRepository<ProjectResource, Long> getRepository() {
        return projectResourceRepository;
    }

    @Override
    protected BaseCrudMapper<ProjectResource, ProjectResourceDTO> getMapper() {
        return projectResourceMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{TITLE_FIELD, DESCRIPTION_FIELD, CATEGORY_FIELD};
    }

    // ---------------------------------------------------------------------
    // Create
    // ---------------------------------------------------------------------

    @Override
    protected void beforeCreate(ProjectResource entity, ProjectResourceDTO request, ValidationContext ctx) {

        normalize(entity);
        resolveProject(entity, ctx);
        validate(entity.getTitle(), entity.getDescription(), entity.getKind(),
                entity.getUrl(), entity.getCategory(), entity.getOrderIndex(), ctx);

        if (entity.getIsActive() == null) {
            entity.setIsActive(true);
        }
    }

    // ---------------------------------------------------------------------
    // Update
    // ---------------------------------------------------------------------

    @Override
    protected void beforeUpdate(ProjectResource entity, ProjectResourceDTO request, ValidationContext ctx) {

        String title = request.getTitle() != null ? request.getTitle().trim() : entity.getTitle();
        String description = request.getDescription() != null
                ? request.getDescription().trim() : entity.getDescription();
        ResourceKind kind = request.getKind() != null ? request.getKind() : entity.getKind();
        String url = request.getUrl() != null ? request.getUrl().trim() : entity.getUrl();
        String category = request.getCategory() != null ? request.getCategory().trim() : entity.getCategory();
        Integer orderIndex = request.getOrderIndex() != null ? request.getOrderIndex() : entity.getOrderIndex();

        validate(title, description, kind, url, category, orderIndex, ctx);

        // Keep the trimmed values so the mapper persists exactly what was validated.
        request.setTitle(title);
        request.setDescription(description);
        request.setKind(kind);
        request.setUrl(url);
        request.setCategory(category);
        request.setOrderIndex(orderIndex);
    }

    // ---------------------------------------------------------------------
    // Delete
    // ---------------------------------------------------------------------

    @Override
    protected void beforeDelete(ProjectResource entity) {

        projectResourceFileRepository.deleteByResourceId(entity.getId());
    }

    // ---------------------------------------------------------------------
    // Queries
    // ---------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public List<ProjectResourceDTO> getByProject(Long projectId) {

        check("PROJECT_RESOURCE_READ");
        resourceAccessGuard.requireProject(projectId);

        return projectResourceRepository
                .findAllByProjectIdAndIsActiveTrueOrderByOrderIndexAscIdAsc(projectId)
                .stream()
                .map(projectResourceMapper::toResponse)
                .toList();
    }

    /**
     * The generic list endpoint must respect the same team data scope: a
     * trainee can only list resources of projects they belong to (AC04).
     */
    @Override
    @Transactional(readOnly = true)
    public Page<ProjectResourceDTO> getAll(Pageable pageable, String search, ProjectResourceFilter filter) {

        check("PROJECT_RESOURCE_READ");

        if (resourceAccessGuard.isPrivileged()) {
            return super.getAll(pageable, search, filter);
        }

        ProjectResourceFilter safe = filter == null ? new ProjectResourceFilter() : filter;
        List<Long> projectIds = resourceAccessGuard.accessibleProjectIds();

        if (safe.getProjectId() != null) {
            if (!projectIds.contains(safe.getProjectId())) {
                throw new AccessDeniedException(
                        "These project resources are outside your team data scope");
            }
            projectIds = List.of(safe.getProjectId());
        }

        if (projectIds.isEmpty()) {
            return Page.empty(pageable);
        }

        List<Long> scopedProjectIds = projectIds;
        Specification<ProjectResource> spec = (root, query, cb) ->
                root.get("projectId").in(scopedProjectIds);

        if (search != null && !search.isBlank()) {
            String pattern = "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
            spec = spec.and((root, query, cb) -> cb.or(
                    cb.like(cb.lower(root.get("title")), pattern),
                    cb.like(cb.lower(root.get("description")), pattern),
                    cb.like(cb.lower(root.get("category")), pattern)));
        }

        if (safe.getKind() != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("kind"), safe.getKind()));
        }

        if (safe.getCategory() != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("category"), safe.getCategory()));
        }

        if (safe.getTitle() != null && !safe.getTitle().isBlank()) {
            String pattern = "%" + safe.getTitle().trim().toLowerCase(Locale.ROOT) + "%";
            spec = spec.and((root, query, cb) -> cb.like(cb.lower(root.get("title")), pattern));
        }

        if (safe.getIsActive() != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("isActive"), safe.getIsActive()));
        }

        if (safe.getIds() != null && !safe.getIds().isEmpty()) {
            spec = spec.and((root, query, cb) -> root.get("id").in(safe.getIds()));
        }

        return projectResourceRepository.findAll(spec, pageable)
                .map(projectResourceMapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public ProjectResourceDTO getById(Long id) {

        check("PROJECT_RESOURCE_READ");

        ProjectResource entity = projectResourceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Entity not found"));

        resourceAccessGuard.requireProject(entity.getProjectId());

        return projectResourceMapper.toResponse(entity);
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    private void normalize(ProjectResource entity) {

        if (entity.getTitle() != null) {
            entity.setTitle(entity.getTitle().trim());
        }

        if (entity.getDescription() != null) {
            entity.setDescription(entity.getDescription().trim());
        }

        if (entity.getUrl() != null) {
            entity.setUrl(entity.getUrl().trim());
        }

        if (entity.getCategory() != null) {
            entity.setCategory(entity.getCategory().trim());
        }

        if (entity.getKind() == null) {
            entity.setKind(ResourceKind.LINK);
        }

        if (entity.getOrderIndex() == null) {
            entity.setOrderIndex(0);
        }
    }

    private void resolveProject(ProjectResource entity, ValidationContext ctx) {

        if (entity.getProjectId() == null) {
            ctx.add(PROJECT_ID_FIELD, "Project is required");
            return;
        }

        Project project = projectRepository.findById(entity.getProjectId()).orElse(null);

        if (project == null) {
            ctx.add(PROJECT_ID_FIELD, "Project not found: " + entity.getProjectId());
            return;
        }

        entity.setTenantId(project.getTenantId());
    }

    private void validate(String title,
                          String description,
                          ResourceKind kind,
                          String url,
                          String category,
                          Integer orderIndex,
                          ValidationContext ctx) {

        if (title == null || title.isBlank()) {
            ctx.add(TITLE_FIELD, "Title is required");
        } else if (title.length() > MAX_TITLE_LENGTH) {
            ctx.add(TITLE_FIELD, "Title must not exceed " + MAX_TITLE_LENGTH + " characters");
        }

        if (description != null && description.length() > MAX_DESCRIPTION_LENGTH) {
            ctx.add(DESCRIPTION_FIELD,
                    "Description must not exceed " + MAX_DESCRIPTION_LENGTH + " characters");
        }

        if (kind == null) {
            ctx.add(KIND_FIELD, "Kind is required");
        } else if (kind == ResourceKind.LINK && (url == null || url.isBlank())) {
            ctx.add(URL_FIELD, "Url is required for a LINK resource");
        }

        if (url != null && url.length() > MAX_URL_LENGTH) {
            ctx.add(URL_FIELD, "Url must not exceed " + MAX_URL_LENGTH + " characters");
        }

        if (category != null && category.length() > MAX_CATEGORY_LENGTH) {
            ctx.add(CATEGORY_FIELD, "Category must not exceed " + MAX_CATEGORY_LENGTH + " characters");
        }

        if (orderIndex != null && orderIndex < 0) {
            ctx.add(ORDER_INDEX_FIELD, "Order index must not be negative");
        }
    }
}
