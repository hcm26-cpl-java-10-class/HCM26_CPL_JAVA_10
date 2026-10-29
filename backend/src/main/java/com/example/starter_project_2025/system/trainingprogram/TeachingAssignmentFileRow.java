package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;

import java.time.LocalDate;

/** File contract uses curriculum IDs, never Subject IDs in place of Program Subject IDs. */
@ImportEntity("teaching-assignments")
@ExportEntity(fileName = "teaching-assignments", sheetName = "Assignments")
public record TeachingAssignmentFileRow(
        @ImportField(name = "Class ID", required = true) @ExportField(name = "Class ID") Long classId,
        @ImportField(name = "Program Subject ID", required = true) @ExportField(name = "Program Subject ID") Long programSubjectId,
        @ImportField(name = "Trainer ID", required = true) @ExportField(name = "Trainer ID") Long trainerId,
        @ImportField(name = "Role", required = true) @ExportField(name = "Role") AssignmentRole role,
        @ImportField(name = "Effective From", required = true) @ExportField(name = "Effective From") LocalDate effectiveFrom,
        @ImportField(name = "Effective To") @ExportField(name = "Effective To") LocalDate effectiveTo,
        @ExportField(name = "Class") String classCode,
        @ExportField(name = "Subject") String subjectCode,
        @ExportField(name = "Trainer") String trainerName,
        @ImportField(name = "Teaching Slots") @ExportField(name = "Teaching Slots") String teachingSlots
) {
    static TeachingAssignmentFileRow from(TeachingAssignmentResponse row) {
        return new TeachingAssignmentFileRow(row.classId(), row.programSubjectId(), row.trainerId(), row.role(),
                row.effectiveFrom(), row.effectiveTo(), row.classCode(), row.subjectCode(), row.trainerName(),
                row.teachingSlots().stream().map(slot -> slot.getDate() + " " + slot.getStartTime().toString().substring(0, 5)
                        + "-" + slot.getEndTime().toString().substring(0, 5)).collect(java.util.stream.Collectors.joining("; ")));
    }
}
