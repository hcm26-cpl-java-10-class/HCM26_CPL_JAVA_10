package com.example.starter_project_2025.system.class_setup;

import com.example.starter_project_2025.system.class_setup.dto.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@Tag(name = "Class Setup & Teaching Assignment", description = "APIs do Tú phụ trách: Quản lý lớp học, Gán chương trình đào tạo & Phân công giảng dạy")
@RestController
@RequiredArgsConstructor
public class ClassSetupController {

    private final ClassSetupService classSetupService;

    // =========================================================================
    // 1. Gán chương trình đào tạo cho lớp
    // =========================================================================

    @Operation(summary = "Gán phiên bản chương trình đào tạo cho lớp")
    @RequestMapping(value = "/api/classes/{classId}/training-program", method = {RequestMethod.PUT, RequestMethod.PATCH})
    public ResponseEntity<TrainingClassResponse> assignTrainingProgram(
            @PathVariable Long classId,
            @Valid @RequestBody AssignProgramRequest request
    ) {
        TrainingClassResponse response = classSetupService.assignTrainingProgram(classId, request.programId());
        return ResponseEntity.ok(response);
    }

    // =========================================================================
    // 2. Hiển thị danh sách môn học của lớp kèm giảng viên đã phân công
    // =========================================================================

    @Operation(summary = "Hiển thị danh sách môn học của lớp kèm giảng viên đã phân công")
    @GetMapping("/api/classes/{classId}/program-subjects")
    public ResponseEntity<List<ClassProgramSubjectResponse>> getClassProgramSubjects(
            @PathVariable Long classId
    ) {
        List<ClassProgramSubjectResponse> response = classSetupService.getClassProgramSubjects(classId);
        return ResponseEntity.ok(response);
    }

    // =========================================================================
    // 3. Lấy danh sách phân công giảng viên của lớp
    // =========================================================================

    @Operation(summary = "Lấy danh sách phân công giảng viên của lớp (hỗ trợ lọc theo môn, giảng viên, role, trạng thái)")
    @GetMapping("/api/classes/{classId}/teaching-assignments")
    public ResponseEntity<List<TeachingAssignmentResponse>> getClassTeachingAssignments(
            @PathVariable Long classId,
            @RequestParam(required = false) Long programSubjectId,
            @RequestParam(required = false) Long trainerId,
            @RequestParam(required = false) AssignmentRole role,
            @RequestParam(required = false, defaultValue = "false") Boolean activeOnly
    ) {
        List<TeachingAssignmentResponse> response = classSetupService.getClassTeachingAssignments(
                classId, programSubjectId, trainerId, role, activeOnly
        );
        return ResponseEntity.ok(response);
    }

    // =========================================================================
    // 4. Tạo phân công giảng dạy cho môn của lớp
    // =========================================================================

    @Operation(summary = "Gán giảng viên chính (MAIN) hoặc phụ (ASSISTANT) cho môn của lớp")
    @PostMapping("/api/teaching-assignments")
    public ResponseEntity<TeachingAssignmentResponse> createTeachingAssignment(
            @Valid @RequestBody TeachingAssignmentRequest request
    ) {
        TeachingAssignmentResponse response = classSetupService.createTeachingAssignment(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // =========================================================================
    // 5. Cập nhật phân công giảng dạy
    // =========================================================================

    @Operation(summary = "Cập nhật phân công giảng dạy (đổi giảng viên, sửa thời hạn hiệu lực)")
    @PutMapping("/api/teaching-assignments/{id}")
    public ResponseEntity<TeachingAssignmentResponse> updateTeachingAssignment(
            @PathVariable Long id,
            @Valid @RequestBody UpdateTeachingAssignmentRequest request
    ) {
        TeachingAssignmentResponse response = classSetupService.updateTeachingAssignment(id, request);
        return ResponseEntity.ok(response);
    }

    // =========================================================================
    // 6. Bỏ / Ngừng phân công giảng dạy
    // =========================================================================

    @Operation(summary = "Bỏ / Ngừng phân công giảng dạy")
    @DeleteMapping("/api/teaching-assignments/{id}")
    public ResponseEntity<Void> deleteTeachingAssignment(@PathVariable Long id) {
        classSetupService.deleteTeachingAssignment(id);
        return ResponseEntity.noContent().build();
    }

    // =========================================================================
    // 7. Output API bàn giao cho Danh: Danh sách phân công còn hiệu lực tại một ngày
    // =========================================================================

    @Operation(summary = "[Bàn giao Danh] Lấy danh sách phân công còn hiệu lực tại một ngày để tạo StudySession")
    @GetMapping("/api/classes/{classId}/teaching-assignments/available")
    public ResponseEntity<List<AvailableAssignmentResponse>> getAvailableAssignments(
            @PathVariable Long classId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        List<AvailableAssignmentResponse> response = classSetupService.getAvailableAssignments(classId, date);
        return ResponseEntity.ok(response);
    }

    // =========================================================================
    // 8. Output API bàn giao cho Tân: Lấy phân công theo giảng viên
    // =========================================================================

    @Operation(summary = "[Bàn giao Tân] Lấy danh sách phân công giảng dạy theo giảng viên")
    @GetMapping("/api/teaching-assignments")
    public ResponseEntity<List<TeachingAssignmentResponse>> getAssignmentsByTrainer(
            @RequestParam(required = false) Long trainerId
    ) {
        if (trainerId == null) {
            return ResponseEntity.badRequest().build();
        }
        List<TeachingAssignmentResponse> response = classSetupService.getAssignmentsByTrainer(trainerId);
        return ResponseEntity.ok(response);
    }

    // =========================================================================
    // 9. Quản lý Lớp học (CRUD TrainingClass)
    // =========================================================================

    @Operation(summary = "Tìm kiếm và phân trang danh sách lớp học")
    @GetMapping("/api/classes")
    public ResponseEntity<Page<TrainingClassResponse>> searchClasses(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) ClassStatus status,
            @PageableDefault(size = 10) Pageable pageable
    ) {
        Page<TrainingClassResponse> response = classSetupService.searchClasses(keyword, status, pageable);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Xem thông tin chi tiết lớp học")
    @GetMapping("/api/classes/{id}")
    public ResponseEntity<TrainingClassResponse> getClassById(@PathVariable Long id) {
        TrainingClassResponse response = classSetupService.getClassById(id);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Tạo mới lớp học")
    @PostMapping("/api/classes")
    public ResponseEntity<TrainingClassResponse> createClass(
            @Valid @RequestBody TrainingClassRequest request
    ) {
        TrainingClassResponse response = classSetupService.createClass(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @Operation(summary = "Cập nhật thông tin lớp học")
    @PutMapping("/api/classes/{id}")
    public ResponseEntity<TrainingClassResponse> updateClass(
            @PathVariable Long id,
            @Valid @RequestBody TrainingClassRequest request
    ) {
        TrainingClassResponse response = classSetupService.updateClass(id, request);
        return ResponseEntity.ok(response);
    }

    // =========================================================================
    // 10. Quản lý Ghi danh học viên (Enrollment - Bàn giao cho Tân & Hệ thống)
    // =========================================================================

    @Operation(summary = "Xem danh sách học viên ghi danh vào lớp")
    @GetMapping("/api/classes/{classId}/enrollments")
    public ResponseEntity<List<EnrollmentResponse>> getEnrollments(@PathVariable Long classId) {
        List<EnrollmentResponse> response = classSetupService.getEnrollmentsByClassId(classId);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Ghi danh học viên vào lớp học")
    @PostMapping("/api/classes/{classId}/enrollments")
    public ResponseEntity<EnrollmentResponse> enrollStudent(
            @PathVariable Long classId,
            @Valid @RequestBody EnrollmentRequest request
    ) {
        EnrollmentResponse response = classSetupService.enrollStudent(classId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
