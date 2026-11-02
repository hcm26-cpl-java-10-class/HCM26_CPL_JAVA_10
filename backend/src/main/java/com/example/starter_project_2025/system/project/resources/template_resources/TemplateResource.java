package com.example.starter_project_2025.system.project.resources.template_resources;

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
 * Learning resource defined on a {@code ProjectTemplate} (the seed).
 * <p>
 * Rows are copied into {@code project_resources} when a template is assigned to
 * a project; the project copy never points back to this table. The definition
 * is also captured into {@code project_template_version.content_json} by
 * {@code TemplateConfigurationService#capture(...)} so a published version
 * freezes the resource list.
 * <p>
 * The template is stored as a plain identifier ({@code template_id}) for the
 * same reason as {@code ProjectResource.projectId}.
 */
@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "project_template_resources",
        indexes = {
                @Index(name = "idx_template_resource_template", columnList = "template_id"),
                @Index(name = "idx_template_resource_tenant", columnList = "tenant_id")
        }
)
@FieldDefaults(level = AccessLevel.PRIVATE)
@ImportEntity("project_template_resource")
@ExportEntity(fileName = "project-template-resources", sheetName = "Template Resources")
@ResourcePermission("PROJECT_TEMPLATE_RESOURCE")
public class TemplateResource extends BaseEntity {

    @Column(name = "template_id", nullable = false, updatable = false)
    @ImportField(name = "Template Id", required = true)
    @ExportField(name = "Template Id")
    Long templateId;

    /** Owning tenant, derived from the template by the service. */
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
