package com.example.starter_project_2025.system.demo.enrollment;

import com.example.starter_project_2025.security.UserPrincipal;
import lombok.Getter;
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

    public CourseEnrollmentController(
            CourseEnrollmentService enrollmentService) {
        this.enrollmentService = enrollmentService;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ENROLLMENT_CREATE')")
    @ResponseStatus(HttpStatus.CREATED)
    public CourseEnrollmentDTO enroll(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody EnrollRequest request) {

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

    @PostMapping("/departments/preview")
    @PreAuthorize("hasAuthority('ENROLLMENT_CREATE')")
    public DepartmentEnrollmentPreviewDTO previewDepartmentEnrollment(
            @RequestBody DepartmentEnrollRequest request
    ) {
        return enrollmentService.previewDepartmentEnrollment(
                request.getDepartmentId(), request.getCourseId());
    }

    @PostMapping("/departments")
    @PreAuthorize("hasAuthority('ENROLLMENT_CREATE')")
    @ResponseStatus(HttpStatus.CREATED)
    public DepartmentEnrollmentResultDTO enrollDepartment(
            @RequestBody DepartmentEnrollRequest request
    ) {
        return enrollmentService.enrollDepartment(
                request.getDepartmentId(), request.getCourseId());
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
        private Long courseId;
    }

    @Getter
    public static class DepartmentEnrollRequest {
        private Long departmentId;
        private Long courseId;
    }
}
