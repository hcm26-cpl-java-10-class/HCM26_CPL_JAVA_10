package com.example.starter_project_2025.system.project.resources.project_resources;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.PostImport;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.project.resources.ResourceKind;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

/**
 * Learning resource owned by one {@code Project}.
 * <p>
 * The template relation is intentionally not mapped: a project resource is a
 * <em>copy</em> materialised when a template is assigned. The {@code source*}
 * columns only keep the provenance (which template version / template resource
 * row it was cloned from) and are never used to read template data, so editing
 * the template never changes an existing project.
 * <p>
 * Like {@code Sprint}, the owning project is stored as a plain identifier
 * ({@code project_id}) so the generic CRUD/import/export layers keep working
 * without resolving associations.
 */
@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "project_resources",
        indexes = {
                @Index(name = "idx_project_resource_project", columnList = "project_id"),
                @Index(name = "idx_project_resource_tenant", columnList = "tenant_id")
        }
)
@FieldDefaults(level = AccessLevel.PRIVATE)
@ImportEntity("project_resource")
@ExportEntity(fileName = "project-resources", sheetName = "Project Resources")
@ResourcePermission("PROJECT_RESOURCE")
public class ProjectResource extends BaseEntity {

    @Column(name = "project_id", nullable = false, updatable = false)
    @ImportField(name = "Project Id", required = true)
    @ExportField(name = "Project Id")
    Long projectId;

    /**
     * Owning tenant, derived from the project by the service so the module can
     * be filtered per tenant without joining {@code projects}.
     */
    @Column(name = "tenant_id", updatable = false)
    @ImportField(name = "Tenant Id")
    @ExportField(name = "Tenant Id")
    Long tenantId;

    @Column(nullable = false, length = 255)
    @ImportField(name = "Title", required = true)
    @ExportField(name = "Title")
    String title;

    @Column(length = 1000)
    @ImportField(name = "Description")
    @ExportField(name = "Description")
    String description;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @ImportField(name = "Kind")
    @ExportField(name = "Kind")
    ResourceKind kind = ResourceKind.LINK;

    /** External link / repository URL; required for {@link ResourceKind#LINK}. */
    @Column(length = 1000)
    @ImportField(name = "Url")
    @ExportField(name = "Url")
    String url;

    @Column(length = 50)
    @ImportField(name = "Category")
    @ExportField(name = "Category")
    String category;

    @Builder.Default
    @Column(name = "order_index", nullable = false)
    @ImportField(name = "Order Index")
    @ExportField(name = "Order Index")
    Integer orderIndex = 0;

    /** Provenance only: template version this row was cloned from. */
    @Column(name = "source_template_snapshot_id", updatable = false)
    @ExportField(name = "Source Template Snapshot Id")
    Long sourceTemplateSnapshotId;

    /** Provenance only: {@code project_template_resources.id} it was cloned from. */
    @Column(name = "source_template_resource_id", updatable = false)
    @ExportField(name = "Source Template Resource Id")
    Long sourceTemplateResourceId;

    /**
     * Import hook (bulk file import bypasses the service): applies the same
     * normalisation and defaults as the REST create path.
     */
    @PostImport
    void prepareForImport() {

        if (title != null) {
            title = title.trim();
        }

        if (description != null) {
            description = description.trim();
        }

        if (url != null) {
            url = url.trim();
        }

        if (category != null) {
            category = category.trim();
        }

        if (kind == null) {
            kind = ResourceKind.LINK;
        }

        if (orderIndex == null) {
            orderIndex = 0;
        }

        if (isActive == null) {
            isActive = true;
        }
    }
}
