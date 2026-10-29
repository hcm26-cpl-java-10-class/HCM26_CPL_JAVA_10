package com.example.starter_project_2025.system.demo.enrollment;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.department.DepartmentMemberDTO;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import io.swagger.v3.oas.annotations.tags.Tag;

import java.util.List;

@RestController
@RequestMapping("/api/enrollments")
@Tag(name = "Course Enrollment", description = "Course enrollment APIs")
public class CourseEnrollmentController {

    private final CourseEnrollmentService enrollmentService;
    private final UserRepository userRepository;

    public CourseEnrollmentController(
            CourseEnrollmentService enrollmentService,
            UserRepository userRepository) {
        this.enrollmentService = enrollmentService;
        this.userRepository = userRepository;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ENROLLMENT_CREATE')")
    @ResponseStatus(HttpStatus.CREATED)
    public CourseEnrollmentDTO enroll(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody EnrollRequest request) {

        Long userId = getUserId(principal);

        CourseEnrollment enrollment = enrollmentService.enroll(
                userId, request.getCourseId());

        return toDTO(enrollment);
    }

    @GetMapping("/my-courses")
    @PreAuthorize("hasAuthority('ENROLLMENT_READ')")
    public List<CourseEnrollmentDTO> getMyCourses(
            @AuthenticationPrincipal UserPrincipal principal) {

        Long userId = getUserId(principal);

        return enrollmentService.getMyCourses(userId)
                .stream()
                .map(this::toDTO)
                .toList();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ENROLLMENT_DELETE')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancelEnrollment(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id) {

        Long userId = getUserId(principal);
        enrollmentService.cancelEnrollment(userId, id);
    }

    @GetMapping("/departments/assigned")
    @PreAuthorize("hasAuthority('DEPARTMENT_READ')")
    public List<Long> getAssignedDepartmentIds(@RequestParam Long courseId) {
        return enrollmentService.getFullyEnrolledDepartmentIds(courseId);
    }

    @PostMapping("/departments/preview")
    @PreAuthorize("hasAuthority('DEPARTMENT_UPDATE')")
    public DepartmentEnrollmentPreviewDTO previewDepartmentEnrollment(
            @Valid @RequestBody DepartmentEnrollRequest request
    ) {
        return enrollmentService.previewDepartmentEnrollment(
                request.getDepartmentId(), request.getCourseId(),
                request.getExcludedStudentIds());
    }

    @PostMapping("/departments")
    @PreAuthorize("hasAuthority('DEPARTMENT_UPDATE')")
    @ResponseStatus(HttpStatus.CREATED)
    public DepartmentEnrollmentResultDTO enrollDepartment(
            @Valid @RequestBody DepartmentEnrollRequest request
    ) {
        return enrollmentService.enrollDepartment(
                request.getDepartmentId(), request.getCourseId(),
                request.getExcludedStudentIds());
    }

    @PostMapping("/departments/batch/preview")
    @PreAuthorize("hasAuthority('DEPARTMENT_UPDATE')")
    public DepartmentBatchEnrollmentResultDTO previewDepartmentsEnrollment(
            @Valid @RequestBody BatchDepartmentEnrollRequest request
    ) {
        return enrollmentService.previewDepartmentsEnrollment(
                request.getCourseId(), request.getDepartments());
    }

    @PostMapping("/departments/batch")
    @PreAuthorize("hasAuthority('DEPARTMENT_UPDATE')")
    @ResponseStatus(HttpStatus.CREATED)
    public DepartmentBatchEnrollmentResultDTO enrollDepartments(
            @Valid @RequestBody BatchDepartmentEnrollRequest request
    ) {
        return enrollmentService.enrollDepartments(
                request.getCourseId(), request.getDepartments());
    }

    @GetMapping("/students")
    @PreAuthorize("hasAuthority('DEPARTMENT_READ')")
    public Page<DepartmentMemberDTO> searchStudents(
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20, sort = "firstName") Pageable pageable
    ) {
        String normalizedSearch = search == null || search.isBlank()
                ? null
                : search.trim();
        return userRepository.searchActiveStudents(normalizedSearch, pageable);
    }

    @GetMapping("/students/{studentId}/courses")
    @PreAuthorize("hasAuthority('DEPARTMENT_READ')")
    public List<CourseEnrollmentDTO> getStudentCourses(
            @PathVariable Long studentId
    ) {
        return enrollmentService.getStudentCourses(studentId)
                .stream()
                .map(this::toDTO)
                .toList();
    }

    @PostMapping("/students")
    @PreAuthorize("hasAuthority('DEPARTMENT_UPDATE')")
    @ResponseStatus(HttpStatus.CREATED)
    public CourseEnrollmentDTO enrollStudent(
            @Valid @RequestBody StudentEnrollRequest request
    ) {
        return toDTO(enrollmentService.enrollStudent(
                request.getStudentId(), request.getCourseId()));
    }

    private Long getUserId(UserPrincipal principal) {
        if (principal == null || principal.getUser() == null) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Please log in first");
        }

        return principal.getUser().getId();
    }

    private CourseEnrollmentDTO toDTO(CourseEnrollment enrollment) {
        return CourseEnrollmentDTO.builder()
                .id(enrollment.getId())
                .courseId(enrollment.getCourse().getId())
                .courseName(enrollment.getCourse().getName())
                .thumbnailUrl(enrollment.getCourse().getThumbnailUrl())
                .instructor(enrollment.getCourse().getInstructor())
                .enrolledAt(enrollment.getCreatedAt())
                .build();
    }

    @Getter
    public static class EnrollRequest {
        @NotNull(message = "Course ID is required")
        private Long courseId;
    }

    @Getter
    public static class DepartmentEnrollRequest {
        @NotNull(message = "Department ID is required")
        private Long departmentId;
        @NotNull(message = "Course ID is required")
        private Long courseId;
        private List<Long> excludedStudentIds;
    }

    @Getter
    public static class BatchDepartmentEnrollRequest {
        @NotNull(message = "Course ID is required")
        private Long courseId;
        @NotEmpty(message = "At least one department is required")
        @Valid
        private List<DepartmentSelection> departments;
    }

    @Getter
    public static class StudentEnrollRequest {
        @NotNull(message = "Student ID is required")
        private Long studentId;
        @NotNull(message = "Course ID is required")
        private Long courseId;
    }
}
