package com.example.starter_project_2025.service;

import com.example.starter_project_2025.system.learning.LearningRecordsService;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentService;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class LearningRecordsServiceTest {
    final UserRepository users = mock(UserRepository.class);
    final CourseEnrollmentService enrollments = mock(CourseEnrollmentService.class);
    final LearningRecordsService service = new LearningRecordsService(enrollments, users);
    @Test void nonexistentOrInvalidTargetsAreRejected() {
        for (Long id : new Long[]{null, -1L, 0L, 99L}) {
            assertThrows(ResourceNotFoundException.class, () -> service.forUser(id));
        }
        verifyNoInteractions(enrollments);
    }
    @Test void noEnrollmentsDoesNotFabricateProgressOrCertificates() {
        when(users.existsById(7L)).thenReturn(true);
        when(enrollments.getMyCourses(7L)).thenReturn(java.util.List.of());
        var records = service.forUser(7L);
        assertTrue(records.enrolledCourses().isEmpty());
        assertNull(records.overallProgress());
        assertNull(records.completedCourses());
        assertNull(records.certificates());
        assertNull(records.learningActivity());
        verify(enrollments).getMyCourses(7L);
    }
}
