package com.example.starter_project_2025.system.project.resources.project_resource_files;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.resources.ProjectResourceAccessGuard;
import com.example.starter_project_2025.system.project.resources.project_resources.ProjectResource;
import com.example.starter_project_2025.system.project.resources.project_resources.ProjectResourceRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * CRUD use case of {@link ProjectResourceFile}.
 * <p>
 * File rows are metadata only; the bytes are uploaded through the storage
 * service and referenced by {@code storageKey}. Business rules:
 * <ul>
 *     <li>{@code resourceId} is mandatory, must reference an existing project
 *     resource and can never be changed afterwards</li>
 *     <li>{@code storageKey}, {@code originalName}, {@code contentType} are
 *     mandatory and {@code sizeBytes} must be positive</li>
 * </ul>
 */
@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ProjectResourceFileServiceImpl
        extends BaseCrudServiceImpl<ProjectResourceFile, Long, ProjectResourceFileDTO, ProjectResourceFileFilter>
        implements ProjectResourceFileService {

    static final int MAX_STORAGE_KEY_LENGTH = 100;
    static final int MAX_ORIGINAL_NAME_LENGTH = 255;
    static final int MAX_CONTENT_TYPE_LENGTH = 150;

    static final String RESOURCE_ID_FIELD = "resourceId";
    static final String STORAGE_KEY_FIELD = "storageKey";
    static final String ORIGINAL_NAME_FIELD = "originalName";
    static final String CONTENT_TYPE_FIELD = "contentType";
    static final String SIZE_BYTES_FIELD = "sizeBytes";

    ProjectResourceFileMapper projectResourceFileMapper;
    ProjectResourceFileRepository projectResourceFileRepository;
    ProjectResourceRepository projectResourceRepository;
    ProjectResourceAccessGuard resourceAccessGuard;

    @Override
    protected BaseCrudRepository<ProjectResourceFile, Long> getRepository() {
        return projectResourceFileRepository;
    }

    @Override
    protected BaseCrudMapper<ProjectResourceFile, ProjectResourceFileDTO> getMapper() {
        return projectResourceFileMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{ORIGINAL_NAME_FIELD, CONTENT_TYPE_FIELD, STORAGE_KEY_FIELD};
    }

    @Override
    protected void beforeCreate(ProjectResourceFile entity,
                                ProjectResourceFileDTO request,
                                ValidationContext ctx) {

        normalize(entity);
        validateResource(entity.getResourceId(), ctx);
        validate(entity.getStorageKey(), entity.getOriginalName(), entity.getContentType(),
                entity.getSizeBytes(), ctx);

        if (entity.getIsActive() == null) {
            entity.setIsActive(true);
        }
    }

    @Override
    protected void beforeUpdate(ProjectResourceFile entity,
                                ProjectResourceFileDTO request,
                                ValidationContext ctx) {

        String storageKey = request.getStorageKey() != null
                ? request.getStorageKey().trim() : entity.getStorageKey();
        String originalName = request.getOriginalName() != null
                ? request.getOriginalName().trim() : entity.getOriginalName();
        String contentType = request.getContentType() != null
                ? request.getContentType().trim() : entity.getContentType();
        Long sizeBytes = request.getSizeBytes() != null ? request.getSizeBytes() : entity.getSizeBytes();

        validate(storageKey, originalName, contentType, sizeBytes, ctx);

        request.setStorageKey(storageKey);
        request.setOriginalName(originalName);
        request.setContentType(contentType);
        request.setSizeBytes(sizeBytes);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProjectResourceFileDTO> getByResource(Long resourceId) {

        check("PROJECT_RESOURCE_FILE_READ");
        requireResourceScope(resourceId);

        return projectResourceFileRepository.findAllByResourceIdOrderByIdAsc(resourceId)
                .stream()
                .map(projectResourceFileMapper::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ProjectResourceFileDTO> getAll(Pageable pageable,
                                               String search,
                                               ProjectResourceFileFilter filter) {

        check("PROJECT_RESOURCE_FILE_READ");

        if (resourceAccessGuard.isPrivileged()) {
            return super.getAll(pageable, search, filter);
        }

        ProjectResourceFileFilter safe = filter == null ? new ProjectResourceFileFilter() : filter;

        if (safe.getResourceId() == null) {
            return Page.empty(pageable);
        }

        requireResourceScope(safe.getResourceId());

        ProjectResourceFileFilter scoped = new ProjectResourceFileFilter();
        scoped.setResourceId(safe.getResourceId());
        scoped.setOriginalName(safe.getOriginalName());
        scoped.setContentType(safe.getContentType());
        scoped.setIds(safe.getIds());
        scoped.setIsActive(safe.getIsActive());
        scoped.setCreatedRange(safe.getCreatedRange());
        scoped.setUpdatedRange(safe.getUpdatedRange());
        scoped.setCreatedBy(safe.getCreatedBy());
        scoped.setUpdatedBy(safe.getUpdatedBy());

        return super.getAll(pageable, search, scoped);
    }

    @Override
    @Transactional(readOnly = true)
    public ProjectResourceFileDTO getById(Long id) {

        check("PROJECT_RESOURCE_FILE_READ");

        ProjectResourceFile entity = projectResourceFileRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Entity not found"));

        requireResourceScope(entity.getResourceId());

        return projectResourceFileMapper.toResponse(entity);
    }

    private void requireResourceScope(Long resourceId) {

        ProjectResource resource = projectResourceRepository.findById(resourceId)
                .orElseThrow(() -> new ResourceNotFoundException("Entity not found"));

        resourceAccessGuard.requireProject(resource.getProjectId());
    }

    private void normalize(ProjectResourceFile entity) {

        if (entity.getStorageKey() != null) {
            entity.setStorageKey(entity.getStorageKey().trim());
        }

        if (entity.getOriginalName() != null) {
            entity.setOriginalName(entity.getOriginalName().trim());
        }

        if (entity.getContentType() != null) {
            entity.setContentType(entity.getContentType().trim());
        }
    }

    private void validateResource(Long resourceId, ValidationContext ctx) {

        if (resourceId == null) {
            ctx.add(RESOURCE_ID_FIELD, "Project resource is required");
            return;
        }

        if (!projectResourceRepository.existsById(resourceId)) {
            ctx.add(RESOURCE_ID_FIELD, "Project resource not found: " + resourceId);
        }
    }

    private void validate(String storageKey,
                          String originalName,
                          String contentType,
                          Long sizeBytes,
                          ValidationContext ctx) {

        if (storageKey == null || storageKey.isBlank()) {
            ctx.add(STORAGE_KEY_FIELD, "Storage key is required");
        } else if (storageKey.length() > MAX_STORAGE_KEY_LENGTH) {
            ctx.add(STORAGE_KEY_FIELD, "Storage key must not exceed " + MAX_STORAGE_KEY_LENGTH + " characters");
        }

        if (originalName == null || originalName.isBlank()) {
            ctx.add(ORIGINAL_NAME_FIELD, "Original name is required");
        } else if (originalName.length() > MAX_ORIGINAL_NAME_LENGTH) {
            ctx.add(ORIGINAL_NAME_FIELD,
                    "Original name must not exceed " + MAX_ORIGINAL_NAME_LENGTH + " characters");
        }

        if (contentType == null || contentType.isBlank()) {
            ctx.add(CONTENT_TYPE_FIELD, "Content type is required");
        } else if (contentType.length() > MAX_CONTENT_TYPE_LENGTH) {
            ctx.add(CONTENT_TYPE_FIELD,
                    "Content type must not exceed " + MAX_CONTENT_TYPE_LENGTH + " characters");
        }

        if (sizeBytes == null || sizeBytes <= 0) {
            ctx.add(SIZE_BYTES_FIELD, "Size must be greater than zero");
        }
    }
}
