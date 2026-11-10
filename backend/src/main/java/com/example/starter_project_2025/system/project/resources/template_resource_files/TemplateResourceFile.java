package com.example.starter_project_2025.system.project.resources.template_resource_files;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.PostImport;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

/**
 * Stored file of a {@code TemplateResource}.
 * <p>
 * Metadata only: the bytes live in object storage under {@code storageKey}
 * (same convention as {@code ArtifactAttachment}). Project copies created when
 * a template is assigned reuse the same key, so the object itself is never
 * duplicated.
 */
@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "project_template_resource_files",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_template_resource_file_key",
                columnNames = {"resource_id", "storage_key"}),
        indexes = @Index(name = "idx_template_resource_file_resource", columnList = "resource_id")
)
@FieldDefaults(level = AccessLevel.PRIVATE)
@ImportEntity("template_resource_file")
@ExportEntity(fileName = "template-resource-files", sheetName = "Template Resource Files")
@ResourcePermission("PROJECT_TEMPLATE_RESOURCE_FILE")
public class TemplateResourceFile extends BaseEntity {

    @Column(name = "resource_id", nullable = false, updatable = false)
    @ImportField(name = "Resource Id", required = true)
    @ExportField(name = "Resource Id")
    Long resourceId;

    @Column(name = "storage_key", nullable = false, length = 100)
    @ImportField(name = "Storage Key", required = true)
    @ExportField(name = "Storage Key")
    String storageKey;

    @Column(name = "original_name", nullable = false, length = 255)
    @ImportField(name = "Original Name", required = true)
    @ExportField(name = "Original Name")
    String originalName;

    @Column(name = "content_type", nullable = false, length = 150)
    @ImportField(name = "Content Type", required = true)
    @ExportField(name = "Content Type")
    String contentType;

    @Column(name = "size_bytes", nullable = false)
    @ImportField(name = "Size Bytes", required = true)
    @ExportField(name = "Size Bytes")
    Long sizeBytes;

    @PostImport
    void prepareForImport() {

        if (storageKey != null) {
            storageKey = storageKey.trim();
        }

        if (originalName != null) {
            originalName = originalName.trim();
        }

        if (contentType != null) {
            contentType = contentType.trim();
        }

        if (isActive == null) {
            isActive = true;
        }
    }
}
