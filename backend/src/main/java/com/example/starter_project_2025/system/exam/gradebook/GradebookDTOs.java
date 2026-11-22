package com.example.starter_project_2025.system.exam.gradebook;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/** DTO cua man hinh Score Management. */
public final class GradebookDTOs {
        private GradebookDTOs() {
        }

        public record CourseItem(Long id, String name, int studentCount, int columnCount) {
        }

        public record ColumnDto(Long id, String name, String type, BigDecimal weightPercent, Long examId,
                        String examTitle, boolean published) {
        }

        public record StudentRow(Long id, String name, String email, String code,
                        Map<Long, BigDecimal> scores, BigDecimal finalScore) {
        }

        public record Gradebook(Long courseId, String courseName, List<ColumnDto> columns,
                        BigDecimal totalWeight, List<StudentRow> students,
                        java.time.LocalDateTime savedAt, boolean unsaved) {
        }

        public record ScanResult(Gradebook gradebook, int created, int refreshed, List<ImportReport> reports) {
        }

        public record ColumnRequest(String name, BigDecimal weightPercent, String type) {
        }

        public record ImportRequest(Long examId) {
        }

        public record AvailableExam(Long id, String title, String courseName, boolean inCourse, int attemptCount) {
        }

        public record PersonItem(Long id, String name, String email, String code, BigDecimal score, String reason) {
        }

        /**
         * extra = co bai thi nhung khong co trong lop; missing = co trong lop nhung
         * khong co diem bai thi.
         */
        public record ImportReport(Long columnId, String columnName, Long examId, String examTitle,
                        int imported, List<PersonItem> extra, List<PersonItem> missing, boolean published) {
        }

        // ---------------------------------------------------------------- class
        // aggregation

        public record ClassItem(Long id, String code, String name, int studentCount, int assessmentCount) {
        }

        /**
         * One column = one assessment type (QUIZ, ASSIGNMENT, MIDTERM, FINAL_TEST)
         * across all assessments of that type.
         */
        public record ClassTypeColumn(String type, String label, int examCount, int scoredCount,
                        List<String> examTitles) {
        }

        public record ClassStudentRow(Long id, String name, String email, String code,
                        Map<String, BigDecimal> scores, BigDecimal averageScore, int examCount) {
        }

        public record ClassGradebook(Long classId, String classCode, String className,
                        List<ClassTypeColumn> columns, List<ClassStudentRow> students,
                        Map<String, BigDecimal> columnAverages, BigDecimal classAverage) {
        }
}
