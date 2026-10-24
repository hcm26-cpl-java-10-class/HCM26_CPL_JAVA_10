package com.example.starter_project_2025.system.project.project_template_version;

import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.experimental.FieldDefaults;

/**
 * Flat export row for the project template version Excel/CSV export.
 * <p>
 * Materialising the row keeps the export headers aligned with the import
 * template, so an exported file can be re-imported as-is.
 */
@Getter
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@ExportEntity(fileName = "project-template-versions", sheetName = "Project Template Versions")
public class ProjectTemplateSnapshotExportRow {

    @ExportField(name = "Template Id")
    String templateId;

    @ExportField(name = "Project Id")
    String projectId;

    @ExportField(name = "Version")
    String version;

    @ExportField(name = "Parent Template Id")
    String parentTemplateId;

    @ExportField(name = "Status")
    String status;

    @ExportField(name = "Content JSON")
    String contentJson;

    @ExportField(name = "Active")
    String active;

    public static ProjectTemplateSnapshotExportRow from(ProjectTemplateSnapshot snapshot) {
        return new ProjectTemplateSnapshotExportRow(
                snapshot.getTemplateId() == null ? "" : snapshot.getTemplateId().toString(),
                snapshot.getProjectId() == null ? "" : snapshot.getProjectId().toString(),
                snapshot.getVersion(),
                snapshot.getParentTemplateId() == null ? "" : snapshot.getParentTemplateId().toString(),
                snapshot.getStatus() == null ? "" : snapshot.getStatus().name(),
                snapshot.getContentJson(),
                Boolean.TRUE.equals(snapshot.getIsActive()) ? "TRUE" : "FALSE"
        );
    }
}
