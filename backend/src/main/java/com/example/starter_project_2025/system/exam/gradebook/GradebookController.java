package com.example.starter_project_2025.system.exam.gradebook;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.gradebook.GradebookDTOs.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Score Management: bang diem theo course (giang vien). */
@RestController
@RequestMapping("/api/score-management")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('EXAM_UPDATE')")
public class GradebookController {

    private final GradebookService service;
    private final ClassGradebookService classService;

    @GetMapping("/courses")
    public ResponseEntity<List<CourseItem>> courses(@AuthenticationPrincipal UserPrincipal p) {
        return ResponseEntity.ok(service.listCourses(p));
    }

    /** Tab Class: danh sach lop. */
    @GetMapping("/classes")
    public ResponseEntity<List<ClassItem>> classes(@AuthenticationPrincipal UserPrincipal p) {
        return ResponseEntity.ok(classService.listClasses(p));
    }

    /**
     * Tab Class: diem tong ket cua thanh vien trong lop, tong hop qua cac course.
     */
    @GetMapping("/classes/{classId}")
    public ResponseEntity<ClassGradebook> classGradebook(@PathVariable Long classId,
            @AuthenticationPrincipal UserPrincipal p) {
        return ResponseEntity.ok(classService.getClassGradebook(classId, p));
    }

    @GetMapping("/courses/{courseId}")
    public ResponseEntity<Gradebook> gradebook(@PathVariable Long courseId, @AuthenticationPrincipal UserPrincipal p) {
        return ResponseEntity.ok(service.getGradebook(courseId, p));
    }

    @PostMapping("/courses/{courseId}/save")
    public ResponseEntity<Gradebook> save(@PathVariable Long courseId, @AuthenticationPrincipal UserPrincipal p) {
        return ResponseEntity.ok(service.save(courseId, p));
    }

    @PostMapping("/courses/{courseId}/auto-scan")
    public ResponseEntity<ScanResult> autoScan(@PathVariable Long courseId, @AuthenticationPrincipal UserPrincipal p) {
        return ResponseEntity.ok(service.autoScan(courseId, p));
    }

    @PostMapping("/courses/{courseId}/columns")
    public ResponseEntity<Gradebook> addColumn(@PathVariable Long courseId, @RequestBody ColumnRequest req,
            @AuthenticationPrincipal UserPrincipal p) {
        return ResponseEntity.ok(service.addColumn(courseId, req, p));
    }

    @PutMapping("/columns/{columnId}")
    public ResponseEntity<Gradebook> updateColumn(@PathVariable Long columnId, @RequestBody ColumnRequest req,
            @AuthenticationPrincipal UserPrincipal p) {
        return ResponseEntity.ok(service.updateColumn(columnId, req, p));
    }

    @DeleteMapping("/columns/{columnId}")
    public ResponseEntity<Gradebook> deleteColumn(@PathVariable Long columnId,
            @AuthenticationPrincipal UserPrincipal p) {
        return ResponseEntity.ok(service.deleteColumn(columnId, p));
    }

    @GetMapping("/courses/{courseId}/history")
    public ResponseEntity<java.util.List<GradebookSaveLog>> history(@PathVariable Long courseId,
            @AuthenticationPrincipal UserPrincipal p) {
        return ResponseEntity.ok(service.history(courseId, p));
    }

    @GetMapping("/courses/{courseId}/available-exams")
    public ResponseEntity<List<AvailableExam>> availableExams(@PathVariable Long courseId,
            @RequestParam(required = false) String type,
            @AuthenticationPrincipal UserPrincipal p) {
        return ResponseEntity.ok(service.availableExams(courseId, type, p));
    }

    @PostMapping("/columns/{columnId}/import")
    public ResponseEntity<ImportReport> importExam(@PathVariable Long columnId, @RequestBody ImportRequest req,
            @AuthenticationPrincipal UserPrincipal p) {
        return ResponseEntity.ok(service.importExam(columnId, req, p));
    }

    @GetMapping("/columns/{columnId}/report")
    public ResponseEntity<ImportReport> report(@PathVariable Long columnId, @AuthenticationPrincipal UserPrincipal p) {
        return ResponseEntity.ok(service.report(columnId, p));
    }
}
