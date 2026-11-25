package com.example.starter_project_2025.system.learning.roadmap;

import com.example.starter_project_2025.system.demo.certificate.CertificateRepository;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseLevel;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.course.CourseStatus;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentService;
import com.example.starter_project_2025.system.demo.lesson.CatalogCourseDTO;
import com.example.starter_project_2025.system.demo.lesson.CourseCatalogService;
import com.example.starter_project_2025.system.demo.lesson.CourseLessonStats;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.progress.LessonProgressService;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RoadmapCatalogTest {
    @Test
    void convertsPublishedLessonSecondsForBothGenerationAndSavedRoadmapDisplay() {
        var catalog = mock(CourseCatalogService.class);
        var courses = mock(CourseRepository.class);
        var lessons = mock(LessonRepository.class);
        var roadmaps = new RoadmapCatalog(catalog, courses, mock(CourseEnrollmentService.class),
                mock(LessonProgressService.class), mock(CertificateRepository.class), lessons);
        Set<Long> ids = Set.of(7L, 8L);
        when(catalog.search(nullable(String.class), isNull(), isNull(), any(), isNull()))
                .thenReturn(new PageImpl<>(List.of(candidate(7L, 3601), candidate(8L, 0))));
        when(courses.findAllById(ids)).thenReturn(List.of(course(7L), course(8L)));
        when(lessons.findStatsByCourseIds(ids)).thenReturn(List.of(
                new CourseLessonStats(7L, 2L, 3601L), new CourseLessonStats(8L, 1L, 0L)));

        var goal = new RoadmapGoal("Java Backend Developer", CourseLevel.BEGINNER, 8, null, 24);
        var candidates = roadmaps.candidates(9L, goal);
        var views = roadmaps.courseViews(9L, ids);

        assertEquals(List.of(61L, 0L), candidates.stream().map(RoadmapCatalog.Candidate::durationMinutes).toList());
        assertEquals(61L, views.get(7L).durationMinutes());
        assertNull(views.get(8L).durationMinutes());
    }

    private CatalogCourseDTO candidate(Long id, long seconds) {
        return new CatalogCourseDTO(id, "Java", "Java basics", null, null, null, null,
                CourseLevel.BEGINNER, 2, seconds, true, false, 0.0, 0L);
    }

    private Course course(Long id) {
        return Course.builder().id(id).name("Java").status(CourseStatus.PUBLISHED).isActive(true).build();
    }
}
