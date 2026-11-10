package com.example.starter_project_2025.system.demo.analytics;

import com.example.starter_project_2025.system.demo.analytics.CourseAnalyticsDTO.Granularity;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.time.LocalDate;

/**
 * Xuất dữ liệu Course Analytics ra Excel.
 *
 * <p>Mỗi phần analytics có 1 endpoint riêng (file 1 sheet), kèm 1 endpoint
 * {@code /export-all} gom <b>tất cả</b> các phần vào một file .xlsx nhiều sheet.
 */
@RestController
@RequestMapping("/api/reports/export")
@Tag(name = "Course Analytics Export", description = "Export course analytics to Excel (.xlsx)")
@RequiredArgsConstructor
@PreAuthorize("hasAnyAuthority('COURSE_REPORT_READ', 'COURSE_READ')")
public class CourseAnalyticsExportController {

    private static final MediaType XLSX = MediaType.parseMediaType(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final CourseAnalyticsExportService exportService;

    // =====================================================================
    // Export tổng (master export)
    // =====================================================================

    @GetMapping("/all")
    @Operation(summary = "Export tất cả analytics của một khóa học ra 1 file Excel nhiều sheet")
    public ResponseEntity<byte[]> exportAll(
            @RequestParam Long courseId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Granularity granularity) throws IOException {
        byte[] file = exportService.exportAll(courseId, from, to, granularity);
        return attachment(file, "course-analytics-all-" + courseId + ".xlsx");
    }

    // =====================================================================
    // Export từng phần
    // =====================================================================

    @GetMapping("/lesson-funnel")
    @Operation(summary = "Export phễu học tập ra Excel")
    public ResponseEntity<byte[]> exportLessonFunnel(@RequestParam Long courseId) throws IOException {
        return attachment(exportService.exportLessonFunnel(courseId),
                "course-analytics-funnel-" + courseId + ".xlsx");
    }

    @GetMapping("/trend")
    @Operation(summary = "Export xu hướng theo thời gian ra Excel")
    public ResponseEntity<byte[]> exportTrend(
            @RequestParam Long courseId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Granularity granularity) throws IOException {
        return attachment(exportService.exportTrend(courseId, from, to, granularity),
                "course-analytics-trend-" + courseId + ".xlsx");
    }

    @GetMapping("/activity")
    @Operation(summary = "Export mức độ hoạt động + học viên nguy cơ bỏ học ra Excel")
    public ResponseEntity<byte[]> exportActivity(@RequestParam Long courseId) throws IOException {
        return attachment(exportService.exportActivity(courseId),
                "course-analytics-activity-" + courseId + ".xlsx");
    }

    @GetMapping("/reviews")
    @Operation(summary = "Export phân tích đánh giá ra Excel")
    public ResponseEntity<byte[]> exportReviews(@RequestParam Long courseId) throws IOException {
        return attachment(exportService.exportReviews(courseId),
                "course-analytics-reviews-" + courseId + ".xlsx");
    }

    @GetMapping("/departments")
    @Operation(summary = "Export phân tích phòng ban ra Excel")
    public ResponseEntity<byte[]> exportDepartments(
            @RequestParam(required = false) Long courseId) throws IOException {
        return attachment(exportService.exportDepartments(courseId),
                "course-analytics-departments.xlsx");
    }

    @GetMapping("/course-ranking")
    @Operation(summary = "Export bảng xếp hạng khóa học ra Excel")
    public ResponseEntity<byte[]> exportCourseRanking() throws IOException {
        return attachment(exportService.exportCourseRanking(),
                "course-analytics-course-ranking.xlsx");
    }

    @GetMapping("/content-quality")
    @Operation(summary = "Export chất lượng nội dung + Q&A ra Excel")
    public ResponseEntity<byte[]> exportContentQuality(@RequestParam Long courseId) throws IOException {
        return attachment(exportService.exportContentQuality(courseId),
                "course-analytics-content-quality-" + courseId + ".xlsx");
    }

    @GetMapping("/exams")
    @Operation(summary = "Export kết quả bài thi ra Excel")
    public ResponseEntity<byte[]> exportExams(@RequestParam Long courseId) throws IOException {
        return attachment(exportService.exportExams(courseId),
                "course-analytics-exams-" + courseId + ".xlsx");
    }

    // =====================================================================

    private static ResponseEntity<byte[]> attachment(byte[] file, String filename) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .header("Access-Control-Expose-Headers", "Content-Disposition")
                .contentType(XLSX)
                .body(file);
    }
}
