package com.example.starter_project_2025.system.learning.report;

import com.example.starter_project_2025.exception.error.ErrorResponse;
import com.example.starter_project_2025.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import java.io.IOException;
import java.time.*;
import static com.example.starter_project_2025.system.learning.report.ReportData.*;

@RestController
@RequestMapping("/api/learning/me/reports")
@PreAuthorize("hasAuthority('LEARNER_ACCESS') and hasAuthority('LEARNING_SELF_READ')")
@RequiredArgsConstructor
public class ReportController {
    private final ReportService reports;
    private final ReportExport exports;
    private final ReportAggregation aggregation;

    @GetMapping("/performance")
    public PerformanceDashboard performance(@AuthenticationPrincipal UserPrincipal principal,
        @RequestParam(required = false) LocalDate from,
        @RequestParam(required = false) LocalDate to,
        @RequestParam(required = false) Long courseId) {
        return aggregation.performanceDashboard(principal, from, to, courseId);
    }

    @GetMapping("/goals-habits")
    public GoalsHabitsDashboard goalsHabits(@AuthenticationPrincipal UserPrincipal principal,
        @RequestParam(required = false) LocalDate from,
        @RequestParam(required = false) LocalDate to) {
        return aggregation.goalsHabitsDashboard(principal, from, to);
    }

    @GetMapping("/options")
    public Options options(@AuthenticationPrincipal UserPrincipal principal) { return reports.options(principal); }
    @PostMapping
    public Detail create(@AuthenticationPrincipal UserPrincipal principal, @Valid @RequestBody Input input) {
        return reports.create(principal, input);
    }
    @GetMapping
    public History history(@AuthenticationPrincipal UserPrincipal principal,
        @RequestParam(required=false) Type type, @RequestParam(required=false) LocalDate from,
        @RequestParam(required=false) LocalDate to, @RequestParam(defaultValue="0") int page,
        @RequestParam(defaultValue="10") int size) {
        return reports.history(principal, type, from, to, page, size);
    }
    @GetMapping("/{id}")
    public Detail detail(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long id) {
        return reports.detail(principal, id);
    }
    @PatchMapping("/{id}/title")
    public Item rename(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long id, @Valid @RequestBody Title title) {
        return reports.rename(principal, id, title);
    }
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long id) {
        reports.delete(principal, id);
    }
    @PostMapping("/{id}/retry-ai")
    public Detail retry(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long id) {
        return reports.retry(principal, id);
    }
    @GetMapping("/{id}/export/xlsx")
    public ResponseEntity<byte[]> workbook(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long id) throws IOException {
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"learning-report-" + id + ".xlsx\"")
            .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
            .body(exports.workbook(reports.detail(principal, id)));
    }
    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse invalid() { return new ErrorResponse(400, "Check the report fields and date formats", LocalDateTime.now()); }
}
