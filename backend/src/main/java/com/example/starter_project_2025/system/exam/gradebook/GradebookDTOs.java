package com.example.starter_project_2025.system.exam.gradebook;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/** DTO cua man hinh Score Management. */
public final class GradebookDTOs {
    private GradebookDTOs() {}

    public record CourseItem(Long id, String name, int studentCount, int columnCount) {}

    public record ColumnDto(Long id, String name, String type, BigDecimal weightPercent, Long examId, String examTitle) {}

    public record StudentRow(Long id, String name, String email, String code,
                             Map<Long, BigDecimal> scores, BigDecimal finalScore) {}

    public record Gradebook(Long courseId, String courseName, List<ColumnDto> columns,
                            BigDecimal totalWeight, List<StudentRow> students,
                            java.time.LocalDateTime savedAt) {}

    public record ScanResult(Gradebook gradebook, int created, int refreshed, List<ImportReport> reports) {}

    public record ColumnRequest(String name, BigDecimal weightPercent, String type) {}

    public record CellRequest(Long columnId, Long studentId, BigDecimal score) {}

    public record ImportRequest(Long examId) {}

    public record AvailableExam(Long id, String title, String courseName, boolean inCourse, int attemptCount) {}

    public record PersonItem(Long id, String name, String email, String code, BigDecimal score, String reason) {}

    /** extra = co bai thi nhung khong co trong lop; missing = co trong lop nhung khong co diem bai thi. */
    public record ImportReport(Long columnId, String columnName, Long examId, String examTitle,
                               int imported, List<PersonItem> extra, List<PersonItem> missing) {}
}
