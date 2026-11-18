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
 * template, so an exported file can be re-imported as-is. The
 * {@code Template Name} / {@code Project Name} columns are the readable
 * projection of the raw ids: the importer resolves them when the id columns are
 * left empty, and ignores them when the ids are present.
 */
@Getter
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@ExportEntity(fileName = "project-template-versions", sheetName = "Project Template Versions")
public class ProjectTemplateSnapshotExportRow {

    @ExportField(name = "Template Id")
    String templateId;

    @ExportField(name = "Template Name")
    String templateName;

    @ExportField(name = "Project Id")
    String projectId;

    @ExportField(name = "Project Name")
    String projectName;

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

    /**
     * Builds one export row.
     *
     * @param snapshot     persisted snapshot
     * @param templateName resolved name of {@code templateId} (may be {@code null})
     * @param projectName  resolved name of {@code projectId} (may be {@code null})
     */
    public static ProjectTemplateSnapshotExportRow from(ProjectTemplateSnapshot snapshot,
                                                        String templateName,
                                                        String projectName) {
        return new ProjectTemplateSnapshotExportRow(
                stringify(snapshot.getTemplateId()),
                nullToEmpty(templateName),
                stringify(snapshot.getProjectId()),
                nullToEmpty(projectName),
                snapshot.getVersion(),
                stringify(snapshot.getParentTemplateId()),
                snapshot.getStatus() == null ? "" : snapshot.getStatus().name(),
                snapshot.getContentJson(),
                Boolean.TRUE.equals(snapshot.getIsActive()) ? "TRUE" : "FALSE"
        );
    }

    private static String stringify(Long value) {
        return value == null ? "" : value.toString();
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
