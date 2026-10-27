package com.example.starter_project_2025.system.trainingprogram;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import com.example.starter_project_2025.exception.error.ValidationErrorResponse;
import com.example.starter_project_2025.system.demo.session.Session;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ClassSetupController {
    private final ClassSetupService service;

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ValidationErrorResponse> invalidRequest(Exception exception) {
        return ResponseEntity.badRequest().body(new ValidationErrorResponse(
                "Use valid IDs, a non-negative revision, a MAIN or ASSISTANT role and dates in YYYY-MM-DD format.", Map.of()));
    }

    @PutMapping("/classes/{classId}/training-program")
    @PreAuthorize("hasAuthority('CLASS_UPDATE_PROGRAM')")
    public ResponseEntity<ClassProgramSubjectsResponse> assignProgram(@PathVariable Long classId,
                                                                       @Valid @RequestBody ClassProgramAssignmentRequest request) {
        return ResponseEntity.ok(service.assignProgram(classId, request.programId()));
    }

    @GetMapping("/classes/{classId}/program-subjects")
    @PreAuthorize("hasAuthority('CLASS_READ')")
    public ResponseEntity<ClassProgramSubjectsResponse> getProgramSubjects(@PathVariable Long classId) {
        return ResponseEntity.ok(service.getClassProgramSubjects(classId));
    }

    @GetMapping("/classes/{classId}/teaching-assignments")
    @PreAuthorize("hasAuthority('ASSIGNMENT_READ')")
    public ResponseEntity<List<TeachingAssignmentResponse>> getClassAssignments(@PathVariable Long classId) {
        return ResponseEntity.ok(service.getClassAssignments(classId));
    }

    @GetMapping("/classes/{classId}/teaching-assignments/available")
    @PreAuthorize("hasAuthority('ASSIGNMENT_READ')")
    public ResponseEntity<List<TeachingAssignmentResponse>> getAvailableClassAssignments(
            @PathVariable Long classId,
            @RequestParam(required = false) LocalDate date) {
        return ResponseEntity.ok(service.getAvailableClassAssignments(classId, date));
    }

    @GetMapping("/teaching-assignments")
    @PreAuthorize("hasAuthority('ASSIGNMENT_READ')")
    public ResponseEntity<Page<TeachingAssignmentResponse>> searchAssignments(
            @RequestParam(required = false) Long classId,
            @RequestParam(required = false) Long programSubjectId,
            @RequestParam(required = false) Long trainerId,
            @RequestParam(required = false) AssignmentRole role,
            @RequestParam(required = false) LocalDate effectiveOn,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long subjectId,
            @PageableDefault(size = 20, sort = "effectiveFrom") Pageable pageable) {
        return ResponseEntity.ok(service.searchAssignments(classId, programSubjectId, trainerId,
                role, effectiveOn, search, subjectId, pageable));
    }

    @GetMapping("/teaching-assignments/options")
    @PreAuthorize("hasAuthority('ASSIGNMENT_READ')")
    public ResponseEntity<TeachingAssignmentOptions> getAssignmentOptions() {
        return ResponseEntity.ok(service.getAssignmentOptions());
    }

    @GetMapping("/teaching-assignments/{id}")
    @PreAuthorize("hasAuthority('ASSIGNMENT_READ')")
    public ResponseEntity<TeachingAssignmentResponse> getAssignment(@PathVariable Long id) {
        return ResponseEntity.ok(service.getAssignment(id));
    }

    @GetMapping("/teaching-assignments/{id}/sessions")
    @PreAuthorize("hasAuthority('ASSIGNMENT_READ')")
    public ResponseEntity<Page<TeachingAssignmentSessionResponse>> getAssignmentSessions(
            @PathVariable Long id,
            @RequestParam(required = false) String status,
            @PageableDefault(size = 20, sort = "startTime") Pageable pageable) {
        return ResponseEntity.ok(service.getAssignmentSessions(id,
                status == null ? null : Session.SessionStatus.valueOf(status), pageable));
    }

    @GetMapping("/teaching-assignments/create-options")
    @PreAuthorize("hasAuthority('ASSIGNMENT_CREATE')")
    public ResponseEntity<TeachingAssignmentCreateOptions> getAssignmentCreateOptions() {
        return ResponseEntity.ok(service.getAssignmentCreateOptions());
    }

    @GetMapping("/teaching-assignments/create-context")
    @PreAuthorize("hasAuthority('ASSIGNMENT_CREATE')")
    public ResponseEntity<TeachingAssignmentCreateOptions.ClassContext> getAssignmentCreateContext(@RequestParam Long classId) {
        return ResponseEntity.ok(service.getAssignmentCreateContext(classId));
    }

    @PostMapping("/teaching-assignments")
    @PreAuthorize("hasAuthority('ASSIGNMENT_CREATE')")
    public ResponseEntity<TeachingAssignmentResponse> createAssignment(@Valid @RequestBody TeachingAssignmentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createAssignment(request));
    }

    @PutMapping("/teaching-assignments/{id}")
    @PreAuthorize("hasAuthority('ASSIGNMENT_UPDATE')")
    public ResponseEntity<TeachingAssignmentResponse> updateAssignment(@PathVariable Long id,
                                                                         @Valid @RequestBody TeachingAssignmentRequest request) {
        return ResponseEntity.ok(service.updateAssignment(id, request));
    }

    @GetMapping("/teaching-assignments/{id}/edit-context")
    @PreAuthorize("hasAuthority('ASSIGNMENT_UPDATE')")
    public ResponseEntity<TeachingAssignmentEditContext> getAssignmentEditContext(@PathVariable Long id) {
        return ResponseEntity.ok(service.getAssignmentEditContext(id));
    }

    @PostMapping("/teaching-assignments/{id}/impact-preview")
    @PreAuthorize("hasAuthority('ASSIGNMENT_UPDATE')")
    public ResponseEntity<TeachingAssignmentImpactResponse> previewAssignmentImpact(@PathVariable Long id,
            @Valid @RequestBody TeachingAssignmentRequest request, @PageableDefault(size = 10) Pageable pageable) {
        return ResponseEntity.ok(service.previewAssignmentImpact(id, request, pageable));
    }

    @DeleteMapping("/teaching-assignments/{id}")
    @PreAuthorize("hasAuthority('ASSIGNMENT_DELETE')")
    public ResponseEntity<Void> deleteAssignment(@PathVariable Long id, @RequestParam(required = false) Long revision) {
        service.deleteAssignment(id, revision);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/teaching-assignments/{id}/lifecycle-context")
    @PreAuthorize("hasAnyAuthority('ASSIGNMENT_UPDATE', 'ASSIGNMENT_DELETE')")
    public ResponseEntity<TeachingAssignmentLifecycleContext> getAssignmentLifecycleContext(@PathVariable Long id) {
        return ResponseEntity.ok(service.getAssignmentLifecycleContext(id));
    }

    @PostMapping("/teaching-assignments/{id}/end-preview")
    @PreAuthorize("hasAuthority('ASSIGNMENT_UPDATE')")
    public ResponseEntity<TeachingAssignmentImpactResponse> previewAssignmentEnd(@PathVariable Long id,
            @Valid @RequestBody TeachingAssignmentEndRequest request, @PageableDefault(size = 10) Pageable pageable) {
        return ResponseEntity.ok(service.previewAssignmentEnd(id, request, pageable));
    }

    @PatchMapping("/teaching-assignments/{id}/end")
    @PreAuthorize("hasAuthority('ASSIGNMENT_UPDATE')")
    public ResponseEntity<TeachingAssignmentResponse> endAssignment(@PathVariable Long id,
            @Valid @RequestBody TeachingAssignmentEndRequest request) {
        return ResponseEntity.ok(service.endAssignment(id, request));
    }
}
