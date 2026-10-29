package com.example.starter_project_2025.system.project.project_template_version;

import com.example.starter_project_2025.base.crud.CrudAction;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.project_template_version.audit.ProjectTemplateSnapshotAuditLogDTO;
import com.example.starter_project_2025.system.project.project_template_version.audit.ProjectTemplateSnapshotAuditService;
import com.example.starter_project_2025.system.project.project_template_version.event.ProjectTemplateSnapshotOutboxService;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestone;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

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
 *     <li>{@link #duplicateTemplate(Long, String)} creates a brand new
 *     Project Template (new name) whose first version is always
 *     {@code v1.0} / {@code DRAFT}, copies the configuration and keeps
 *     {@code parentTemplateId} empty (no version-tree link to the source)</li>
 *     <li>audit log (actor, timestamp, before/after, correlation id) + outbox
 *     event (idempotent)</li>
 * </ul>
 * <p>
 * The ProjectTemplate / Project relations are never validated (both modules are
 * owned by other team members, so {@code templateId} and {@code projectId} are
 * only carried along and any id is accepted), but they are resolved read-only on
 * every response: {@code templateName} / {@code projectName} are filled from the
 * owning rows so the clients never render a raw id.
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
    static final String PARENT_TEMPLATE_ID_FIELD = "parentTemplateId";
    static final String VERSION_FIELD = "version";
    static final String CONTENT_JSON_FIELD = "contentJson";
    static final String NAME_FIELD = "name";

    /** US-08: the copy always starts at the default version label. */
    static final String DUPLICATE_INITIAL_VERSION = "v1.0";

    /** US-07: baseline version created together with a new Project Template. */
    static final String INITIAL_VERSION = "v1.0";

    /** Mirrors the {@code ProjectTemplate.name} column. */
    static final int MAX_NAME_LENGTH = 255;

    /** Fallback when the source template row is unknown (owned by another team). */
    static final String DEFAULT_CONSTRAINTS_JSON = "{}";

    static final String PERMISSION_READ = "PROJECT_TEMPLATE_VERSION_READ";

    /** US-07: audit action that distinguishes a derived version from a plain create. */
    static final String ACTION_NEW_VERSION = "CREATE_NEW_VERSION";

    /** US-07 / AC01: audit action of the baseline version of a new template. */
    static final String ACTION_INITIAL_VERSION = "CREATE_INITIAL_VERSION";

    /** US-07: audit action of the DRAFT -> PUBLISHED transition. */
    static final String ACTION_PUBLISH = "PUBLISH";

    /** US-08: audit action of a template duplication. */
    static final String ACTION_DUPLICATE = "DUPLICATE";

    static final String EVENT_CREATED = "PROJECT_TEMPLATE_VERSION_CREATED";
    static final String EVENT_UPDATED = "PROJECT_TEMPLATE_VERSION_UPDATED";
    static final String EVENT_DELETED = "PROJECT_TEMPLATE_VERSION_DELETED";

    ProjectTemplateSnapshotMapper snapshotMapper;
    ProjectTemplateSnapshotRepository snapshotRepository;
    ProjectTemplateSnapshotAuditService snapshotAuditService;
    ProjectTemplateSnapshotOutboxService snapshotOutboxService;
    /**
     * Used by {@link #duplicateTemplate(Long, String)} (US-08) to store
     * the {@code name} of the copy.
     * <p>
     * TODO(project-template): when the Project Template module exposes its own
     * service/DTO layer, replace these repository calls with that service so the
     * ownership of {@code project_templates} stays in a single module.
     */
    ProjectTemplateRepository projectTemplateRepository;
    /** Read-only lookup of the {@code project} rows behind {@code projectId}. */
    ProjectRepository projectRepository;
    /** Used to derive the baseline snapshot payload from the template plan. */
    TemplateMilestoneRepository templateMilestoneRepository;
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
        validateTemplateExists(snapshot.getTemplateId(), errors);
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

        // US-07: the Project Template row reports the same revision as its
        // newest version (v2.0 -> template_version = 2).
        syncTemplateVersion(saved.getTemplateId(), nextVersion);

        // AC01: the audit trail records that this row was derived from another
        // version (not just "created"), so the lineage can be reviewed later.
        // AC02: the source row is only read here - it is never saved, therefore
        // its content (the snapshot already used by workspaces/projects) stays
        // byte-for-byte identical.
        Map<String, Object> after = snapshot(saved);
        after.put("sourceVersionId", source.getId());
        after.put("sourceVersion", source.getVersion());
        after.put("sourceStatus", source.getStatus() == null ? null : source.getStatus().name());

        snapshotAuditService.record(
                ACTION_NEW_VERSION, saved.getId(), saved.getTemplateId(), saved.getProjectId(), null, after);

        snapshotOutboxService.enqueue(
                EVENT_CREATED,
                saved.getId(),
                saved.getTemplateId(),
                saved.getProjectId(),
                currentActorEmail(),
                after);

        return toResponse(saved);
    }

    // ---------------------------------------------------------------------
    // Baseline version of a new template (US-07 / AC01)
    // ---------------------------------------------------------------------

    /**
     * {@inheritDoc}
     * <p>
     * The payload is derived from the Project Template itself (overview,
     * constraints and milestone plan), so the very first version of a template
     * already carries its whole configuration instead of an empty JSON blob.
     */
    @Override
    public ProjectTemplateSnapshotDTO createInitialVersion(ProjectTemplate template) {

        if (template == null || template.getId() == null) {
            return null;
        }

        // Idempotent: a template owns exactly one v1.0 baseline.
        if (!snapshotRepository.findByTemplateIdOrderByCreatedAtDesc(template.getId()).isEmpty()) {
            return null;
        }

        ProjectTemplateSnapshot baseline = ProjectTemplateSnapshot.builder()
                .templateId(template.getId())
                // A template is a reusable blueprint: it is not bound to a project yet.
                .projectId(null)
                // First version of the chain: nothing to trace back to.
                .parentTemplateId(null)
                .version(INITIAL_VERSION)
                .contentJson(initialContentJson(template))
                .status(ProjectTemplateVersionStatus.DRAFT)
                .isActive(true)
                .build();

        ProjectTemplateSnapshot saved = snapshotRepository.save(baseline);

        Map<String, Object> after = snapshot(saved);
        after.put("sourceTemplateId", template.getId());
        after.put("sourceTemplateCode", template.getCode());

        snapshotAuditService.record(
                ACTION_INITIAL_VERSION, saved.getId(), saved.getTemplateId(), saved.getProjectId(), null, after);

        snapshotOutboxService.enqueue(
                EVENT_CREATED,
                saved.getId(),
                saved.getTemplateId(),
                saved.getProjectId(),
                currentActorEmail(),
                after);

        return toResponse(saved);
    }

    @Override
    public ProjectTemplateSnapshotDTO createInitialVersion(Long templateId) {

        if (templateId == null) {
            return null;
        }

        return createInitialVersion(projectTemplateRepository.findById(templateId).orElse(null));
    }

    // ---------------------------------------------------------------------
    // Publish the newest version (US-07)
    // ---------------------------------------------------------------------

    /**
     * {@inheritDoc}
     * <p>
     * Only the newest active version is promoted; every older row is left
     * untouched, so the snapshots already consumed by workspaces/projects can
     * never be rewritten by a later revision (AC02).
     */
    @Override
    public ProjectTemplateSnapshotDTO publishLatestVersion(ProjectTemplate template) {

        if (template == null || template.getId() == null) {
            return null;
        }

        ProjectTemplateSnapshot latest = snapshotRepository
                .findFirstByTemplateIdAndIsActiveTrueOrderByCreatedAtDesc(template.getId())
                .orElse(null);

        if (latest == null) {
            return null;
        }

        if (latest.getStatus() != ProjectTemplateVersionStatus.DRAFT) {
            return toResponse(latest);
        }

        Map<String, Object> before = snapshot(latest);

        // AC01: the version that goes live mirrors the template configuration
        // that is being activated (the baseline was built before the Program
        // Manager filled in milestones / sample content).
        latest.setContentJson(initialContentJson(template));
        latest.setStatus(ProjectTemplateVersionStatus.PUBLISHED);

        ProjectTemplateSnapshot saved = snapshotRepository.save(latest);

        Map<String, Object> after = snapshot(saved);

        snapshotAuditService.record(
                ACTION_PUBLISH, saved.getId(), saved.getTemplateId(), saved.getProjectId(), before, after);

        snapshotOutboxService.enqueue(
                EVENT_UPDATED,
                saved.getId(),
                saved.getTemplateId(),
                saved.getProjectId(),
                currentActorEmail(),
                after);

        return toResponse(saved);
    }

    // ---------------------------------------------------------------------
    // Duplicate as a new template (US-08)
    // ---------------------------------------------------------------------

    /**
     * US-08 / AC01: duplicates the given version into a brand new Project
     * Template.
     * <p>
     * Steps:
     * <ol>
     *     <li>validate the mandatory {@code name} of the copy, plus the source
     *     configuration (must still be valid JSON)</li>
     *     <li>insert an independent {@code ProjectTemplate} row carrying the new
     *     name and a copy of the source {@code constraintsJson}</li>
     *     <li>insert the first version of that template: {@code v1.0},
     *     {@code DRAFT}, copied {@code contentJson},
     *     {@code parentTemplateId = null} (no version-tree link to the
     *     original) and no project binding</li>
     *     <li>write the audit trail ({@code DUPLICATE}) and the outbox
     *     {@code CREATED} event, both pointing at the new snapshot</li>
     * </ol>
     * The source template and its versions are never modified, which is what
     * keeps the copy and the original fully independent.
     * <p>
     * The whole method runs in the class level transaction, so a failure while
     * saving the snapshot rolls the new {@code ProjectTemplate} row back
     * instead of leaving it orphaned.
     */
    @Override
    public ProjectTemplateSnapshotDTO duplicateTemplate(Long sourceVersionId, String name) {

        checkPermission(CrudAction.CREATE);

        ProjectTemplateSnapshot source = findSnapshot(sourceVersionId);

        String newName = trimToNull(name);

        Map<String, List<String>> errors = new LinkedHashMap<>();

        validateName(newName, errors);
        validateContentJson(source.getContentJson(), errors);

        throwIfInvalid(errors);

        // 1) The copy owns a brand new ProjectTemplate (new name).
        ProjectTemplate duplicatedTemplate =
                createIndependentTemplate(source.getTemplateId(), newName);

        // 2) v1.0 DRAFT snapshot of the new template: configuration copied,
        //    but no parent_template_id link back to the source version.
        ProjectTemplateSnapshot created = ProjectTemplateSnapshot.builder()
                .templateId(duplicatedTemplate.getId())
                // A duplicate belongs to no project yet: it is a reusable blueprint.
                .projectId(null)
                // US-08: unlike createNewVersion(), the copy keeps NO lineage.
                .parentTemplateId(null)
                .version(DUPLICATE_INITIAL_VERSION)
                // Strings are immutable, the source row can never be mutated.
                .contentJson(source.getContentJson())
                .status(ProjectTemplateVersionStatus.DRAFT)
                .isActive(true)
                .build();

        ProjectTemplateSnapshot saved = snapshotRepository.save(created);

        Map<String, Object> before = snapshot(source);
        Map<String, Object> after = snapshot(saved);
        after.put("duplicatedFromSnapshotId", source.getId());
        after.put("duplicatedFromTemplateId", source.getTemplateId());
        after.put("duplicateName", duplicatedTemplate.getName());

        snapshotAuditService.record(
                ACTION_DUPLICATE, saved.getId(), saved.getTemplateId(), saved.getProjectId(), before, after);

        snapshotOutboxService.enqueue(
                EVENT_CREATED,
                saved.getId(),
                saved.getTemplateId(),
                saved.getProjectId(),
                currentActorEmail(),
                after);

        return toResponse(saved);
    }

    /**
     * Creates the {@code ProjectTemplate} row the duplicate hangs from, copying
     * the business constraints of the source template when it is known.
     * <p>
     * The Project Template module is owned by another team member and currently
     * only exposes the entity + repository, so the row is written directly
     * here. Swapping these calls for the future {@code ProjectTemplateService}
     * does not change the API, the database or the rules implemented above.
     */
    private ProjectTemplate createIndependentTemplate(Long sourceTemplateId,
                                                      String name) {

        String constraintsJson = sourceTemplateId == null
                ? DEFAULT_CONSTRAINTS_JSON
                : projectTemplateRepository.findById(sourceTemplateId)
                        .map(ProjectTemplate::getConstraintsJson)
                        .filter(value -> value != null && !value.isBlank())
                        .orElse(DEFAULT_CONSTRAINTS_JSON);

        return projectTemplateRepository.save(
                ProjectTemplate.builder()
                        .name(name)
                        .constraintsJson(constraintsJson)
                        .isActive(true)
                        .build());
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

        // US-07 / AC02: a version belongs to the template it was snapshotted
        // from. Moving it to another template would break the per-template
        // version lineage (parentTemplateId) and the snapshot isolation the
        // workspaces already rely on, so the owner is immutable.
        if (request.getTemplateId() != null
                && !request.getTemplateId().equals(snapshot.getTemplateId())) {
            errors.put(TEMPLATE_ID_FIELD,
                    List.of("Không thể thay đổi Project Template của phiên bản đã tạo"));
        }

        // Traceability only: a version can never be its own parent.
        if (parentTemplateId != null && parentTemplateId.equals(snapshot.getId())) {
            errors.put(PARENT_TEMPLATE_ID_FIELD,
                    List.of("Phiên bản không thể là cha của chính nó"));
        }

        // US-07 / AC02 (snapshot isolation): once a version is PUBLISHED or
        // ARCHIVED it is the payload already consumed by workspaces/projects.
        // Rewriting it in place would silently change those projects, so the
        // configuration may only be edited while the version is still DRAFT.
        if (snapshot.getStatus() != null
                && snapshot.getStatus() != ProjectTemplateVersionStatus.DRAFT) {
            if (contentJson != null && !contentJson.equals(snapshot.getContentJson())) {
                errors.put(CONTENT_JSON_FIELD,
                        List.of("Chỉ phiên bản DRAFT mới được sửa nội dung; hãy tạo phiên bản mới để thay đổi cấu hình"));
            }
            if (version != null && !version.equals(snapshot.getVersion())) {
                errors.put(VERSION_FIELD,
                        List.of("Không thể đổi nhãn của phiên bản đã công bố; hãy tạo phiên bản mới"));
            }
        }

        validateTemplateId(templateId, errors);
        validateTemplateExists(templateId, errors);
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

        return toResponse(saved);
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

    /**
     * Enriches every row with the name of its Project Template and Project so
     * the client never has to resolve a raw {@code template_id} / {@code project_id}.
     */
    @Override
    public Page<ProjectTemplateSnapshotDTO> getAll(Pageable pageable,
                                                   String search,
                                                   ProjectTemplateSnapshotFilter filter) {

        Page<ProjectTemplateSnapshotDTO> page = super.getAll(pageable, search, filter);

        enrichOwnerNames(page.getContent());

        return page;
    }

    @Override
    public ProjectTemplateSnapshotDTO getById(Long id) {

        ProjectTemplateSnapshotDTO dto = super.getById(id);

        enrichOwnerNames(List.of(dto));

        return dto;
    }

    @Override
    public ProjectTemplateSnapshotDTO create(ProjectTemplateSnapshotDTO request) {

        ProjectTemplateSnapshotDTO created = super.create(request);

        enrichOwnerNames(List.of(created));

        return created;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProjectTemplateSnapshotDTO> getByTemplate(Long templateId) {

        check(PERMISSION_READ);

        if (templateId == null) {
            throw new ProjectTemplateSnapshotValidationException(
                    TEMPLATE_ID_FIELD, "Vui lòng chọn Project Template");
        }

        List<ProjectTemplateSnapshotDTO> versions = snapshotRepository
                .findByTemplateIdOrderByCreatedAtDesc(templateId)
                .stream()
                .map(snapshotMapper::toResponse)
                .collect(Collectors.toCollection(ArrayList::new));

        enrichOwnerNames(versions);

        return versions;
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

        List<ProjectTemplateSnapshot> snapshots = snapshotRepository.findAll();

        Map<Long, String> templateNames =
                resolveTemplateNames(ownerIds(snapshots, ProjectTemplateSnapshot::getTemplateId));
        Map<Long, String> projectNames =
                resolveProjectNames(ownerIds(snapshots, ProjectTemplateSnapshot::getProjectId));

        return snapshots.stream()
                .map(snapshot -> ProjectTemplateSnapshotExportRow.from(
                        snapshot,
                        templateNames.get(snapshot.getTemplateId()),
                        projectNames.get(snapshot.getProjectId())))
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

    /**
     * US-08: the name of the copy is mandatory and must fit
     * {@code project_templates.name} (255 chars).
     */
    private void validateName(String name, Map<String, List<String>> errors) {

        if (name == null) {
            errors.put(NAME_FIELD, List.of("Vui lòng nhập tên Project Template"));
            return;
        }

        if (name.length() > MAX_NAME_LENGTH) {
            errors.put(NAME_FIELD,
                    List.of("Tên Project Template không vượt quá " + MAX_NAME_LENGTH + " ký tự"));
        }
    }

    private String trimToNull(String value) {

        return value == null || value.isBlank() ? null : value.trim();
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

    // ---------------------------------------------------------------------
    // ProjectTemplate linkage helpers
    // ---------------------------------------------------------------------

    /**
     * US-07: a version can only hang from a Project Template that exists, which
     * turns {@code template_id} from an opaque number into a real reference.
     */
    private void validateTemplateExists(Long templateId, Map<String, List<String>> errors) {

        if (templateId == null) {
            return;
        }

        if (!projectTemplateRepository.existsById(templateId)) {
            errors.put(TEMPLATE_ID_FIELD,
                    List.of("Project Template không tồn tại: " + templateId));
        }
    }

    /**
     * US-07: keeps {@code project_templates.template_version} aligned with the
     * newest snapshot label ({@code v2.0} -> {@code 2}).
     */
    private void syncTemplateVersion(Long templateId, String versionLabel) {

        Integer major = majorOf(versionLabel);

        if (templateId == null || major == null) {
            return;
        }

        projectTemplateRepository.findById(templateId).ifPresent(template -> {
            if (!Objects.equals(template.getTemplateVersion(), major)) {
                template.syncVersion(major);
                projectTemplateRepository.save(template);
            }
        });
    }

    /**
     * US-07 / AC01: baseline payload of a new template, built from the template
     * overview, its team constraints and its milestone plan.
     */
    private String initialContentJson(ProjectTemplate template) {

        Map<String, Object> content = new LinkedHashMap<>();

        content.put("templateId", template.getId());
        content.put("code", template.getCode());
        content.put("name", template.getName());
        content.put("description", template.getDescription());
        content.put("category", template.getCategory());
        content.put("level", template.getLevel() == null ? null : template.getLevel().name());
        content.put("estimatedDurationWeeks", template.getEstimatedDurationWeeks());
        content.put("constraints", readJsonOrNull(template.getConstraintsJson()));
        content.put("milestones", milestonesOf(template.getId()));

        try {
            return objectMapper.writeValueAsString(content);
        } catch (JsonProcessingException ex) {
            return DEFAULT_CONSTRAINTS_JSON;
        }
    }

    private List<Map<String, Object>> milestonesOf(Long templateId) {

        if (templateId == null) {
            return List.of();
        }

        List<TemplateMilestone> plan = templateMilestoneRepository
                .findAllByTemplate_IdOrderByOrderIndexAscIdAsc(templateId);

        List<Map<String, Object>> rows = new ArrayList<>();

        for (TemplateMilestone milestone : plan) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", milestone.getId());
            row.put("title", milestone.getTitle());
            row.put("description", milestone.getDescription());
            row.put("dueAfter", milestone.getDueAfter());
            row.put("dueUnit", milestone.getDueUnit() == null ? null : milestone.getDueUnit().name());
            row.put("weight", milestone.getWeight());
            row.put("mandatory", milestone.isMandatory());
            rows.add(row);
        }

        return rows;
    }

    private Object readJsonOrNull(String json) {

        if (json == null || json.isBlank()) {
            return null;
        }

        try {
            return objectMapper.readTree(json);
        } catch (JsonProcessingException ex) {
            return null;
        }
    }

    /** Mapper output enriched with the owning template / project names. */
    private ProjectTemplateSnapshotDTO toResponse(ProjectTemplateSnapshot snapshot) {

        ProjectTemplateSnapshotDTO dto = snapshotMapper.toResponse(snapshot);

        enrichOwnerNames(List.of(dto));

        return dto;
    }

    /**
     * Fills {@code templateName} and {@code projectName} in one pass so a list
     * response costs two lookups instead of one per row.
     */
    private void enrichOwnerNames(List<ProjectTemplateSnapshotDTO> rows) {

        if (rows == null || rows.isEmpty()) {
            return;
        }

        Map<Long, String> templateNames = resolveTemplateNames(
                rows.stream()
                        .map(ProjectTemplateSnapshotDTO::getTemplateId)
                        .filter(Objects::nonNull)
                        .collect(Collectors.toSet()));

        Map<Long, String> projectNames = resolveProjectNames(
                rows.stream()
                        .map(ProjectTemplateSnapshotDTO::getProjectId)
                        .filter(Objects::nonNull)
                        .collect(Collectors.toSet()));

        rows.forEach(row -> {
            Long templateId = row.getTemplateId();
            Long projectId = row.getProjectId();
            row.setTemplateName(templateId == null ? null : templateNames.get(templateId));
            row.setProjectName(projectId == null ? null : projectNames.get(projectId));
        });
    }

    /** Distinct, non-null owner ids of the given rows. */
    private Set<Long> ownerIds(List<ProjectTemplateSnapshot> snapshots,
                               Function<ProjectTemplateSnapshot, Long> extractor) {
        return snapshots.stream()
                .map(extractor)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
    }

    /** Id -> name of the given Project Templates (missing ids are simply absent). */
    private Map<Long, String> resolveTemplateNames(Set<Long> templateIds) {

        if (templateIds.isEmpty()) {
            return Map.of();
        }

        return projectTemplateRepository.findAllById(templateIds)
                .stream()
                .collect(Collectors.toMap(
                        ProjectTemplate::getId, ProjectTemplate::getName, (left, right) -> left));
    }

    /** Id -> name of the given Projects (missing ids are simply absent). */
    private Map<Long, String> resolveProjectNames(Set<Long> projectIds) {

        if (projectIds.isEmpty()) {
            return Map.of();
        }

        return projectRepository.findAllById(projectIds)
                .stream()
                .collect(Collectors.toMap(
                        Project::getId, Project::getName, (left, right) -> left));
    }
}
