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
 * Materialising the row keeps the export headers aligned with the import
 * template, so an exported file can be re-imported as-is.
 */
@Getter
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@ExportEntity(fileName = "sprints", sheetName = "Sprints")
public class SprintExportRow {

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
