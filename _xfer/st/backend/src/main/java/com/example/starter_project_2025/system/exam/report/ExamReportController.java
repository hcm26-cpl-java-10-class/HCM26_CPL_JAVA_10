package com.example.starter_project_2025.system.exam.report;

import com.example.starter_project_2025.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.Locale;

@RestController
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('EXAM_UPDATE')")
public class ExamReportController {

    private static final MediaType XLSX =
            MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final ExamReportService reportService;
    private final ReportFileWriter writer;

    @GetMapping("/api/exams/{examId}/result-statistics/item-analysis/export")
    public ResponseEntity<byte[]> itemAnalysis(@PathVariable Long examId,
                                               @RequestParam(defaultValue = "xlsx") String format) throws IOException {
        return render(reportService.itemAnalysis(examId), format, "exam-" + examId + "-item-analysis");
    }

    @GetMapping("/api/score-management/courses/{courseId}/export")
    public ResponseEntity<byte[]> gradebook(@PathVariable Long courseId,
                                            @RequestParam(defaultValue = "xlsx") String format,
                                            @AuthenticationPrincipal UserPrincipal principal) throws IOException {
        return render(reportService.gradebook(courseId, principal), format, "course-" + courseId + "-gradebook");
    }

    private ResponseEntity<byte[]> render(ReportTable table, String format, String baseName) throws IOException {
        String f = format == null ? "" : format.trim().toLowerCase(Locale.ROOT);
        byte[] body;
        MediaType type;
        switch (f) {
            case "xlsx" -> {
                body = writer.toExcel(table);
                type = XLSX;
            }
            case "pdf" -> {
                body = writer.toPdf(table);
                type = MediaType.APPLICATION_PDF;
            }
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported export format. Use xlsx or pdf.");
        }
        return ResponseEntity.ok().contentType(type)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + baseName + "." + f + "\"")
                .body(body);
    }
}
