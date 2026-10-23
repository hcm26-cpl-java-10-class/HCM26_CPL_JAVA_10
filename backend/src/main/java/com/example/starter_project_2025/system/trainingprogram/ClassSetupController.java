package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalClassRequest;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
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
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ClassSetupController {
    private final ClassSetupService service;
    private final ClassImportService classImportService;

    @PostMapping(value = "/classes/import", consumes = "multipart/form-data")
    @PreAuthorize("hasAuthority('CLASS_CREATE')")
    public ResponseEntity<ImportResult> importClasses(@RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(classImportService.importFile(file));
    }

    @PostMapping("/classes")
    @PreAuthorize("hasAuthority('CLASS_CREATE')")
    public ResponseEntity<ExternalClassDTO> createClass(@Valid @RequestBody ExternalClassRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createClass(request));
    }

    @PutMapping("/classes/{classId}")
    @PreAuthorize("hasAuthority('CLASS_UPDATE')")
    public ResponseEntity<ExternalClassDTO> updateClass(@PathVariable Long classId,
                                                         @Valid @RequestBody ExternalClassRequest request) {
        return ResponseEntity.ok(service.updateClass(classId, request));
    }

    @DeleteMapping("/classes/{classId}")
    @PreAuthorize("hasAuthority('CLASS_DELETE')")
    public ResponseEntity<Void> deleteClass(@PathVariable Long classId) {
        service.deleteClass(classId);
        return ResponseEntity.noContent().build();
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
            @PageableDefault(size = 20, sort = "effectiveFrom") Pageable pageable) {
        return ResponseEntity.ok(service.searchAssignments(classId, programSubjectId, trainerId,
                role, effectiveOn, pageable));
    }

    @GetMapping("/teaching-assignments/{id}")
    @PreAuthorize("hasAuthority('ASSIGNMENT_READ')")
    public ResponseEntity<TeachingAssignmentResponse> getAssignment(@PathVariable Long id) {
        return ResponseEntity.ok(service.getAssignment(id));
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

    @DeleteMapping("/teaching-assignments/{id}")
    @PreAuthorize("hasAuthority('ASSIGNMENT_DELETE')")
    public ResponseEntity<Void> deleteAssignment(@PathVariable Long id) {
        service.deleteAssignment(id);
        return ResponseEntity.noContent().build();
    }
}
