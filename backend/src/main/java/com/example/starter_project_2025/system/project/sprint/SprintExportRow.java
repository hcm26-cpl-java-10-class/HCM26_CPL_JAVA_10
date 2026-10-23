package com.example.starter_project_2025.system.project.sprint;

import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

/**
 * Flat export row for the sprint Excel/CSV export.
 * <p>
 * The generic exporter resolves relation fields through reflection on the
 * entity instance. Hibernate returns a lazy {@code Project} proxy for
 * {@code Sprint.project}, and reflection on that proxy class cannot find the
 * {@code name} field, which made the export fail. Materialising the row first
 * keeps the export working and produces exactly the headers required by the
 * import template, so an exported file can be re-imported as-is.
 */
@Getter
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@ExportEntity(fileName = "sprints", sheetName = "Sprints")
public class SprintExportRow {

    @ExportField(name = "Project")
    String project;

    @ExportField(name = "Name")
    String name;

    @ExportField(name = "Sprint Goal")
    String sprintGoal;

    @ExportField(name = "Start Date")
    String startDate;

    @ExportField(name = "End Date")
    String endDate;

    @ExportField(name = "Status")
    String status;

    public static SprintExportRow from(Sprint sprint) {
        return new SprintExportRow(
                sprint.getProject() == null ? "" : sprint.getProject().getName(),
                sprint.getName(),
                sprint.getSprintGoal(),
                formatDateTime(sprint.getStartDate()),
                formatDateTime(sprint.getEndDate()),
                sprint.getStatus() == null ? "" : sprint.getStatus().name()
        );
    }

    private static String formatDateTime(LocalDateTime value) {
        return value == null ? "" : value.toString();
    }
}
