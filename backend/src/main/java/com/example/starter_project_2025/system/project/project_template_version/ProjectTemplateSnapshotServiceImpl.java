package com.example.starter_project_2025.system.project.project_template_version;

import com.example.starter_project_2025.base.crud.CrudAction;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.project_template_version.audit.ProjectTemplateSnapshotAuditLogDTO;
import com.example.starter_project_2025.system.project.project_template_version.audit.ProjectTemplateSnapshotAuditService;
import com.example.starter_project_2025.system.project.project_template_version.event.ProjectTemplateSnapshotOutboxService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * CRUD use case implementation for project template versions (snapshots).
 * <p>
 * Business rules covered:
 * <ul>
 *     <li>{@code templateId} is mandatory (the diagram declares
 *     {@code template_id ... NN})</li>
 *     <li>{@code version} is mandatory and 1..50 characters</li>
 *     <li>{@code contentJson} is mandatory and must be valid JSON</li>
 *     <li>{@code version} is unique per template (409)</li>
 *     <li>a new version always starts as
 *     {@link ProjectTemplateVersionStatus#DRAFT}</li>
 *     <li>{@link #createNewVersion(Long)} derives the next version label
 *     automatically ({@code v1.0 -> v2.0}) and keeps
 *     {@code parentTemplateId} for traceability while leaving the source
 *     snapshot untouched (snapshot isolation)</li>
 *     <li>audit log (actor, timestamp, before/after, correlation id) + outbox
 *     event (idempotent)</li>
 * </ul>
 * <p>
 * The ProjectTemplate / Project relations are intentionally not resolved: both
 * modules are owned by other team members, so {@code templateId} and
 * {@code projectId} are only carried along (any id is accepted) and never
 * validated or looked up here.
 */
@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ProjectTemplateSnapshotServiceImpl
        extends BaseCrudServiceImpl<
        ProjectTemplateSnapshot,
        Long,
        ProjectTemplateSnapshotDTO,
        ProjectTemplateSnapshotFilter>
        implements ProjectTemplateSnapshotService {

    static final int MAX_VERSION_LENGTH = 50;

    /**
     * Business version label: optional {@code v} prefix, a major number and an
     * optional minor number ({@code v1}, {@code 1.0}, {@code v2.3}).
     */
    static final Pattern VERSION_LABEL_PATTERN =
            Pattern.compile("^[vV]?(\\d+)(?:\\.(\\d+))?$");

    static final String TEMPLATE_ID_FIELD = "templateId";
    static final String VERSION_FIELD = "version";
    static final String CONTENT_JSON_FIELD = "contentJson";

    static final String PERMISSION_READ = "PROJECT_TEMPLATE_VERSION_READ";

    static final String EVENT_CREATED = "PROJECT_TEMPLATE_VERSION_CREATED";
    static final String EVENT_UPDATED = "PROJECT_TEMPLATE_VERSION_UPDATED";
    static final String EVENT_DELETED = "PROJECT_TEMPLATE_VERSION_DELETED";

    ProjectTemplateSnapshotMapper snapshotMapper;
    ProjectTemplateSnapshotRepository snapshotRepository;
    ProjectTemplateSnapshotAuditService snapshotAuditService;
    ProjectTemplateSnapshotOutboxService snapshotOutboxService;
    ObjectMapper objectMapper;

    @Override
    protected BaseCrudRepository<ProjectTemplateSnapshot, Long> getRepository() {
        return snapshotRepository;
    }

    @Override
    protected BaseCrudMapper<ProjectTemplateSnapshot, ProjectTemplateSnapshotDTO> getMapper() {
        return snapshotMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{"version"};
    }

    // ---------------------------------------------------------------------
    // Create
    // ---------------------------------------------------------------------

    @Override
    protected void beforeCreate(ProjectTemplateSnapshot snapshot,
                                ProjectTemplateSnapshotDTO request,
                                ValidationContext ctx) {

        normalize(snapshot);

        Map<String, List<String>> errors = new LinkedHashMap<>();

        validateTemplateId(snapshot.getTemplateId(), errors);
        validateVersion(snapshot.getVersion(), errors);
        validateContentJson(snapshot.getContentJson(), errors);

        throwIfInvalid(errors);

        ensureUniqueVersion(snapshot.getTemplateId(), snapshot.getVersion(), null);

        if (snapshot.getIsActive() == null) {
            snapshot.setIsActive(true);
        }

        // US-07: a version that is created (directly or as a new version of an
        // existing one) always starts as DRAFT. Existing snapshots are never
        // touched, which keeps every derived workspace/project isolated.
        if (snapshot.getStatus() == null) {
            snapshot.setStatus(ProjectTemplateVersionStatus.DRAFT);
        }
    }

    // ---------------------------------------------------------------------
    // Create new version (US-07)
    // ---------------------------------------------------------------------

    @Override
    public ProjectTemplateSnapshotDTO createNewVersion(Long sourceVersionId) {

        checkPermission(CrudAction.CREATE);

        ProjectTemplateSnapshot source = findSnapshot(sourceVersionId);

        Map<String, List<String>> errors = new LinkedHashMap<>();

        validateTemplateId(source.getTemplateId(), errors);
        validateContentJson(source.getContentJson(), errors);

        throwIfInvalid(errors);

        String nextVersion = nextVersionLabel(source.getTemplateId());

        ProjectTemplateSnapshot created = ProjectTemplateSnapshot.builder()
                .templateId(source.getTemplateId())
                .projectId(source.getProjectId())
                // Traceability: point at the version this one was cloned from.
                .parentTemplateId(source.getId())
                .version(nextVersion)
                // Copy the configuration; strings are immutable so the source
                // snapshot can never be mutated through the new version.
                .contentJson(source.getContentJson())
                .status(ProjectTemplateVersionStatus.DRAFT)
                .isActive(true)
                .build();

        ProjectTemplateSnapshot saved = snapshotRepository.save(created);

        Map<String, Object> after = snapshot(saved);

        snapshotAuditService.record(
                "CREATE", saved.getId(), saved.getTemplateId(), saved.getProjectId(), null, after);

        snapshotOutboxService.enqueue(
                EVENT_CREATED,
                saved.getId(),
                saved.getTemplateId(),
                saved.getProjectId(),
                currentActorEmail(),
                after);

        return snapshotMapper.toResponse(saved);
    }

    @Override
    protected void afterCreate(ProjectTemplateSnapshot saved, ProjectTemplateSnapshotDTO request) {

        Map<String, Object> after = snapshot(saved);

        snapshotAuditService.record(
                "CREATE", saved.getId(), saved.getTemplateId(), saved.getProjectId(), null, after);

        snapshotOutboxService.enqueue(
                EVENT_CREATED,
                saved.getId(),
                saved.getTemplateId(),
                saved.getProjectId(),
                currentActorEmail(),
                after);
    }

    // ---------------------------------------------------------------------
    // Update
    // ---------------------------------------------------------------------

    /**
     * Overridden to keep full control over the audit trail: the base
     * implementation would lose the "before" snapshot once the entity has been
     * mutated.
     */
    @Override
    public ProjectTemplateSnapshotDTO update(Long id, ProjectTemplateSnapshotDTO request) {

        checkPermission(CrudAction.UPDATE);

        ProjectTemplateSnapshot snapshot = findSnapshot(id);

        Long templateId = request.getTemplateId() != null
                ? request.getTemplateId()
                : snapshot.getTemplateId();
        Long projectId = request.getProjectId() != null
                ? request.getProjectId()
                : snapshot.getProjectId();
        Long parentTemplateId = request.getParentTemplateId() != null
                ? request.getParentTemplateId()
                : snapshot.getParentTemplateId();
        ProjectTemplateVersionStatus status = request.getStatus() != null
                ? request.getStatus()
                : snapshot.getStatus();
        String version = request.getVersion() != null
                ? request.getVersion().trim()
                : snapshot.getVersion();
        String contentJson = request.getContentJson() != null
                ? request.getContentJson().trim()
                : snapshot.getContentJson();

        Map<String, List<String>> errors = new LinkedHashMap<>();

        validateTemplateId(templateId, errors);
        validateVersion(version, errors);
        validateContentJson(contentJson, errors);

        throwIfInvalid(errors);

        if (request.getTemplateId() != null || request.getVersion() != null) {
            ensureUniqueVersion(templateId, version, snapshot.getId());
        }

        Map<String, Object> before = snapshot(snapshot);

        request.setTemplateId(templateId);
        request.setProjectId(projectId);
        request.setParentTemplateId(parentTemplateId);
        request.setStatus(status == null ? ProjectTemplateVersionStatus.DRAFT : status);
        request.setVersion(version);
        request.setContentJson(contentJson);

        snapshotMapper.update(snapshot, request);

        ProjectTemplateSnapshot saved = snapshotRepository.save(snapshot);

        Map<String, Object> after = snapshot(saved);

        snapshotAuditService.record(
                "UPDATE", saved.getId(), saved.getTemplateId(), saved.getProjectId(), before, after);

        snapshotOutboxService.enqueue(
                EVENT_UPDATED,
                saved.getId(),
                saved.getTemplateId(),
                saved.getProjectId(),
                currentActorEmail(),
                after);

        return snapshotMapper.toResponse(saved);
    }

    // ---------------------------------------------------------------------
    // Delete
    // ---------------------------------------------------------------------

    @Override
    public void delete(Long id) {

        checkPermission(CrudAction.DELETE);

        ProjectTemplateSnapshot snapshot = findSnapshot(id);

        Map<String, Object> before = snapshot(snapshot);

        snapshotAuditService.record(
                "DELETE", id, snapshot.getTemplateId(), snapshot.getProjectId(), before, null);

        snapshotOutboxService.enqueue(
                EVENT_DELETED,
                id,
                snapshot.getTemplateId(),
                snapshot.getProjectId(),
                currentActorEmail(),
                before);

        snapshotRepository.delete(snapshot);
    }

    // ---------------------------------------------------------------------
    // Queries
    // ---------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public List<ProjectTemplateSnapshotDTO> getByTemplate(Long templateId) {

        check(PERMISSION_READ);

        if (templateId == null) {
            throw new ProjectTemplateSnapshotValidationException(
                    TEMPLATE_ID_FIELD, "Vui lòng chọn Project Template");
        }

        return snapshotRepository.findByTemplateIdOrderByCreatedAtDesc(templateId)
                .stream()
                .map(snapshotMapper::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProjectTemplateSnapshotAuditLogDTO> getAuditLogs(Long snapshotId) {

        check(PERMISSION_READ);

        findSnapshot(snapshotId);

        return snapshotAuditService.getAuditLogs(snapshotId);
    }

    /**
     * Materialises snapshot rows into flat export rows inside the transaction so
     * the generic exporter never touches a lazy association.
     */
    @Override
    @Transactional(readOnly = true)
    public List<ProjectTemplateSnapshotExportRow> getExportRows() {

        check(PERMISSION_READ);

        return snapshotRepository.findAll()
                .stream()
                .map(ProjectTemplateSnapshotExportRow::from)
                .toList();
    }

    // ---------------------------------------------------------------------
    // Validation helpers
    // ---------------------------------------------------------------------

    private ProjectTemplateSnapshot findSnapshot(Long id) {

        if (id == null) {
            throw new ProjectTemplateSnapshotValidationException(
                    "id", "Vui lòng chọn phiên bản Project Template");
        }

        return snapshotRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ProjectTemplateSnapshot", "id", id));
    }

    /**
     * Computes the next business version label of a template (US-07).
     * <p>
     * The highest existing major number is incremented and the minor reset, so
     * {@code v1.0} becomes {@code v2.0} (and {@code v1.1} also becomes
     * {@code v2.0} because only majors are bumped). Unparseable labels are
     * ignored; when no label can be parsed the number of existing versions is
     * used as the next major.
     */
    private String nextVersionLabel(Long templateId) {

        List<ProjectTemplateSnapshot> existing =
                snapshotRepository.findByTemplateIdOrderByCreatedAtDesc(templateId);

        int highestMajor = -1;
        boolean parsedAny = false;

        for (ProjectTemplateSnapshot version : existing) {
            Integer major = majorOf(version.getVersion());
            if (major == null) {
                continue;
            }
            parsedAny = true;
            highestMajor = Math.max(highestMajor, major);
        }

        long nextMajor = parsedAny ? (long) highestMajor + 1 : existing.size() + 1L;

        while (true) {
            String candidate = "v" + nextMajor + ".0";

            if (!snapshotRepository.existsByTemplateIdAndVersion(templateId, candidate)) {
                return candidate;
            }

            nextMajor++;
        }
    }

    /**
     * Major number of a version label, or {@code null} when the label does not
     * follow the {@code v<major>[.<minor>]} convention.
     */
    private Integer majorOf(String versionLabel) {

        if (versionLabel == null) {
            return null;
        }

        Matcher matcher = VERSION_LABEL_PATTERN.matcher(versionLabel.trim());

        if (!matcher.matches()) {
            return null;
        }

        try {
            return Integer.valueOf(matcher.group(1));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private void validateTemplateId(Long templateId, Map<String, List<String>> errors) {

        if (templateId == null) {
            errors.put(TEMPLATE_ID_FIELD, List.of("Vui lòng chọn Project Template"));
        }
    }

    private void validateVersion(String version, Map<String, List<String>> errors) {

        if (version == null || version.isBlank()) {
            errors.put(VERSION_FIELD, List.of("Vui lòng nhập phiên bản của Project Template"));
            return;
        }

        if (version.length() > MAX_VERSION_LENGTH) {
            errors.put(VERSION_FIELD,
                    List.of("Phiên bản không vượt quá " + MAX_VERSION_LENGTH + " ký tự"));
        }
    }

    private void validateContentJson(String contentJson, Map<String, List<String>> errors) {

        if (contentJson == null || contentJson.isBlank()) {
            errors.put(CONTENT_JSON_FIELD, List.of("Vui lòng nhập nội dung snapshot"));
            return;
        }

        try {
            objectMapper.readTree(contentJson);
        } catch (JsonProcessingException ex) {
            addError(errors, CONTENT_JSON_FIELD, "Nội dung snapshot không phải JSON hợp lệ");
        }
    }

    private void ensureUniqueVersion(Long templateId, String version, Long excludedId) {

        if (templateId == null || version == null) {
            return;
        }

        boolean exists = excludedId == null
                ? snapshotRepository.existsByTemplateIdAndVersion(templateId, version)
                : snapshotRepository.existsByTemplateIdAndVersionAndIdNot(templateId, version, excludedId);

        if (exists) {
            throw ProjectTemplateSnapshotConflictException.duplicateVersion();
        }
    }

    private void addError(Map<String, List<String>> errors, String field, String message) {

        errors.computeIfAbsent(field, key -> new ArrayList<>()).add(message);
    }

    private void throwIfInvalid(Map<String, List<String>> errors) {

        if (!errors.isEmpty()) {
            throw new ProjectTemplateSnapshotValidationException(errors);
        }
    }

    private void normalize(ProjectTemplateSnapshot snapshot) {

        if (snapshot.getVersion() != null) {
            snapshot.setVersion(snapshot.getVersion().trim());
        }

        if (snapshot.getContentJson() != null) {
            snapshot.setContentJson(snapshot.getContentJson().trim());
        }

        if (snapshot.getStatus() == null) {
            snapshot.setStatus(ProjectTemplateVersionStatus.DRAFT);
        }
    }

    // ---------------------------------------------------------------------
    // Audit / outbox helpers
    // ---------------------------------------------------------------------

    private Map<String, Object> snapshot(ProjectTemplateSnapshot snapshot) {

        Map<String, Object> state = new LinkedHashMap<>();
        state.put("id", snapshot.getId());
        state.put("templateId", snapshot.getTemplateId());
        state.put("projectId", snapshot.getProjectId());
        state.put("parentTemplateId", snapshot.getParentTemplateId());
        state.put("version", snapshot.getVersion());
        state.put("status", snapshot.getStatus() == null ? null : snapshot.getStatus().name());
        state.put("contentJson", snapshot.getContentJson());
        state.put("isActive", snapshot.getIsActive());
        state.put("createdAt", snapshot.getCreatedAt());
        state.put("updatedAt", snapshot.getUpdatedAt());

        return state;
    }

    private String currentActorEmail() {

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }

        if (authentication.getPrincipal() instanceof UserPrincipal userPrincipal) {
            return userPrincipal.getUsername();
        }

        return authentication.getName();
    }
}
