package com.example.starter_project_2025.system.project.project_template_version;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.PostImport;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.domain.Project;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.Column;
import jakarta.persistence.ConstraintMode;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

/**
 * Immutable-ish snapshot of a Project Template at a given version.
 * <p>
 * Mapping notes (compared to the team's class diagram):
 * <ul>
 *     <li>{@code snapshot_id} is a {@code Long} because {@link BaseEntity} (and
 *     the whole CRUD base: id filters, DTO ids, frontend types) is Long based,
 *     so the diagram's {@code uuid} type is adapted here - same approach as
 *     {@code Sprint#sprintId}.</li>
 *     <li>{@code template_id} (ProjectTemplate) and {@code project_id}
 *     (Project) are stored as plain identifiers: the owning modules are
 *     implemented by other team members, so no writable JPA relation is
 *     declared and no existence check is performed on create. Any id provided
 *     by the client is persisted as-is; the service only resolves the names for
 *     display. File imports may also reference the owners by name through the
 *     transient {@link #templateByName} / {@link #projectByName} fields.</li>
 *     <li>{@code version} is a {@code String} (business version label such as
 *     {@code "v1.0"}), not an optimistic-locking counter. Uniqueness is
 *     enforced per template by {@code uk_project_template_version}.</li>
 *     <li>{@code parent_template_id} stores the id of the version this row was
 *     cloned from (US-07 traceability). It is a plain identifier pointing to
 *     another {@code snapshot_id} of the same template.</li>
 *     <li>{@code status} is the lifecycle state of the version; a new version
 *     is always created as {@link ProjectTemplateVersionStatus#DRAFT}.</li>
 *     <li>{@code created_at} / {@code updated_at} come from {@link BaseEntity}.</li>
 * </ul>
 */
@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "project_template_version",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_project_template_version",
                columnNames = {"template_id", "version"}
        )
)
@FieldDefaults(level = AccessLevel.PRIVATE)
@AttributeOverride(name = "id", column = @Column(name = "snapshot_id"))
@ImportEntity("project_template_version")
@ExportEntity(fileName = "project-template-versions", sheetName = "Project Template Versions")
@ResourcePermission("PROJECT_TEMPLATE_VERSION")
@ResourceMenu(
        title = "Project Template Versions",
        group = "Project Management",
        icon = "layers",
        url = "/project-template-versions",
        order = 4,
        permission = "PROJECT_TEMPLATE_VERSION_READ"
)
public class ProjectTemplateSnapshot extends BaseEntity {

    /** Same limit enforced by {@code ProjectTemplateSnapshotServiceImpl}. */
    static final int MAX_VERSION_LENGTH = 50;

    /** Used by the import hook to reject a malformed {@code contentJson}. */
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    /**
     * Reference to the owning {@code ProjectTemplate}.
     * <p>
     * The project template module is owned by a different team, so only the raw
     * identifier is kept: no relation, no lookup, no business rule relies on it.
     */
    @Column(name = "template_id", nullable = false)
    @ImportField(name = "Template Id")
    @ExportField(name = "Template Id")
    Long templateId;

    /**
     * Owning {@link ProjectTemplate}, resolved through the very same
     * {@code template_id} column as {@link #templateId}.
     * <p>
     * The association is read-only ({@code insertable = false, updatable =
     * false}) so writes keep going through {@link #templateId}, which is what
     * the importer/exporter and the CRUD filter address. A database level
     * foreign key is intentionally not generated
     * ({@link ConstraintMode#NO_CONSTRAINT}) because the sample seeder runs
     * before the template fixtures and legacy rows may point at templates owned
     * by other modules; referential integrity is enforced by
     * {@code ProjectTemplateSnapshotServiceImpl#beforeCreate} instead.
     */
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "template_id", insertable = false, updatable = false,
            foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))
    ProjectTemplate template;

    /**
     * Reference to the {@code Project} the snapshot was taken for (nullable).
     * <p>
     * Same rationale as {@link #templateId}: the project module is external to
     * this repository, so the value is only carried along.
     */
    @Column(name = "project_id")
    @ImportField(name = "Project Id")
    @ExportField(name = "Project Id")
    Long projectId;

    /**
     * Import-only lookup of the owning template by its name.
     * <p>
     * Not persisted: {@code prepareForImport()} copies {@code id} into
     * {@link #templateId}, which stays the single source of truth. Declared so an
     * exported file can be edited with readable names instead of raw ids.
     */
    @Transient
    @JsonIgnore
    @ImportField(name = "Template Name", lookupEntity = ProjectTemplate.class, lookupField = "name")
    ProjectTemplate templateByName;

    /**
     * Import-only lookup of the referenced project by its name.
     * <p>
     * Not persisted: {@code prepareForImport()} copies {@code id} into
     * {@link #projectId}. Optional, exactly like the id column.
     */
    @Transient
    @JsonIgnore
    @ImportField(name = "Project Name", lookupEntity = Project.class, lookupField = "name")
    Project projectByName;

    @Column(name = "version", nullable = false, length = 50)
    @ImportField(name = "Version", required = true)
    @ExportField(name = "Version")
    String version;

    /**
     * Id of the version this row was cloned from ({@code parent_template_id}).
     * <p>
     * Used for historical traceability only: the parent row is never read or
     * modified by the child, which is what keeps the snapshots isolated.
     */
    @Column(name = "parent_template_id")
    @ImportField(name = "Parent Template Id")
    @ExportField(name = "Parent Template Id")
    Long parentTemplateId;

    /**
     * Lifecycle status of the version. New versions start as
     * {@link ProjectTemplateVersionStatus#DRAFT}.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @ImportField(name = "Status")
    @ExportField(name = "Status")
    @Builder.Default
    ProjectTemplateVersionStatus status = ProjectTemplateVersionStatus.DRAFT;

    @Column(name = "content_json", nullable = false, columnDefinition = "TEXT")
    @ImportField(name = "Content JSON", required = true)
    @ExportField(name = "Content JSON")
    String contentJson;

    /**
     * Primary key. The {@code id} field is inherited from {@link BaseEntity}
     * (Long, IDENTITY) and is mapped to the {@code snapshot_id} column by the
     * {@link AttributeOverride} declared on this class.
     */
    public Long getSnapshotId() {
        return getId();
    }

    public void setSnapshotId(Long snapshotId) {
        setId(snapshotId);
    }

    /**
     * Import hook (bulk file import bypasses
     * {@code ProjectTemplateSnapshotServiceImpl}).
     * <p>
     * Applies the same rules the REST create path enforces: the template is
     * required (by id or by name), the version label is trimmed and limited to
     * 50 characters, the content must be valid JSON, and a row without a status
     * starts as {@link ProjectTemplateVersionStatus#DRAFT}.
     */
    @PostImport
    void prepareForImport() {

        // The readable columns are optional and win over the raw ids, so a file
        // exported by this module (both columns filled) stays unambiguous.
        if (templateByName != null) {
            templateId = templateByName.getId();
        }

        if (projectByName != null) {
            projectId = projectByName.getId();
        }

        if (templateId == null) {
            throw new IllegalArgumentException(
                    "Template Id hoặc Template Name là bắt buộc");
        }

        if (version != null) {
            version = version.trim();
            if (version.length() > MAX_VERSION_LENGTH) {
                throw new IllegalArgumentException(
                        "Version không vượt quá " + MAX_VERSION_LENGTH + " ký tự");
            }
        }

        if (contentJson != null) {
            contentJson = contentJson.trim();
        }

        if (contentJson == null || contentJson.isBlank()) {
            throw new IllegalArgumentException("Content JSON không được để trống");
        }

        try {
            OBJECT_MAPPER.readTree(contentJson);
        } catch (Exception exception) {
            throw new IllegalArgumentException("Content JSON không phải JSON hợp lệ");
        }

        if (isActive == null) {
            isActive = true;
        }

        if (status == null) {
            status = ProjectTemplateVersionStatus.DRAFT;
        }
    }
}
