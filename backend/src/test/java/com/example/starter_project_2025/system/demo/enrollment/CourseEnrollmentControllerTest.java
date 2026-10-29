package com.example.starter_project_2025.system.demo.enrollment;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.rbac.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

// Plain unit tests: no Spring context, database, or startup initializers.
class CourseEnrollmentControllerTest {
    private final StubEnrollmentService service = new StubEnrollmentService();
    private final CourseEnrollmentController controller = new CourseEnrollmentController(service);
    private final UserPrincipal principal = new UserPrincipal(User.builder().id(7L).build(), List.of());

    @Test
    void mapsCourseMetadataAndUsesAuthenticatedUser() {
        LocalDateTime enrolledAt = LocalDateTime.of(2026, 10, 30, 10, 0);
        Course course = Course.builder().id(12L).name("Java 21 Fundamentals")
                .description("Original description").instructor("Teacher User").thumbnailUrl(null).build();
        service.results = List.of(CourseEnrollment.builder()
                .id(3L).course(course).createdAt(enrolledAt).build());

        CourseEnrollmentDTO dto = controller.getMyCourses(principal).getFirst();

        assertEquals(3L, dto.getId());
        assertEquals(12L, dto.getCourseId());
        assertEquals("Java 21 Fundamentals", dto.getCourseName());
        assertEquals("Original description", dto.getCourseDescription());
        assertEquals("Teacher User", dto.getInstructor());
        assertNull(dto.getThumbnailUrl());
        assertEquals(enrolledAt, dto.getEnrolledAt());
        assertEquals(7L, service.requestedUserId);
        assertEquals(1, service.calls);
    }

    @Test
    void preservesNullDescriptionAndEmptyEnrollments() {
        service.results = List.of(CourseEnrollment.builder()
                .course(Course.builder().id(12L).name("Course").build()).build());
        assertNull(controller.getMyCourses(principal).getFirst().getCourseDescription());
        service.results = List.of();
        assertTrue(controller.getMyCourses(principal).isEmpty());
    }

    @Test
    void rejectsMissingPrincipalBeforeCallingService() {
        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> controller.getMyCourses(null));
        assertEquals(401, exception.getStatusCode().value());
        assertEquals(0, service.calls);
    }

    private static class StubEnrollmentService extends CourseEnrollmentService {
        List<CourseEnrollment> results = List.of();
        Long requestedUserId;
        int calls;

        StubEnrollmentService() { super(null, null, null); }

        @Override
        public List<CourseEnrollment> getMyCourses(Long userId) {
            requestedUserId = userId;
            calls++;
            return results;
        }
    }
}
