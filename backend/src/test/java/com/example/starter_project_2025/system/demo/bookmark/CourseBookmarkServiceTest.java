package com.example.starter_project_2025.system.demo.bookmark;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseLevel;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.course.CourseStatus;
import com.example.starter_project_2025.system.demo.lesson.CatalogCourseDTO;
import com.example.starter_project_2025.system.demo.lesson.CourseCatalogService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CourseBookmarkServiceTest {

    @Mock
    private CourseBookmarkRepository bookmarkRepository;

    @Mock
    private CourseRepository courseRepository;

    @Mock
    private CourseCatalogService catalogService;

    @InjectMocks
    private CourseBookmarkService service;

    @Test
    void save_persistsBookmarkForActivePublishedCourse() {
        Course course = Course.builder()
                .id(15L)
                .status(CourseStatus.PUBLISHED)
                .isActive(true)
                .build();
        when(courseRepository.findById(15L)).thenReturn(Optional.of(course));
        when(bookmarkRepository.existsByUserIdAndCourseId(7L, 15L)).thenReturn(false);

        CourseBookmarkStatusResponse response = service.save(7L, 15L);

        assertTrue(response.saved());
        assertEquals(15L, response.courseId());
        verify(bookmarkRepository).save(any(CourseBookmark.class));
    }

    @Test
    void save_isIdempotentWhenAlreadySaved() {
        Course course = Course.builder()
                .id(15L)
                .status(CourseStatus.PUBLISHED)
                .isActive(true)
                .build();
        when(courseRepository.findById(15L)).thenReturn(Optional.of(course));
        when(bookmarkRepository.existsByUserIdAndCourseId(7L, 15L)).thenReturn(true);

        CourseBookmarkStatusResponse response = service.save(7L, 15L);

        assertTrue(response.saved());
        verify(bookmarkRepository, never()).save(any());
    }

    @Test
    void save_rejectsDraftOrInactiveCourse() {
        Course draft = Course.builder()
                .id(15L)
                .status(CourseStatus.DRAFT)
                .isActive(true)
                .build();
        when(courseRepository.findById(15L)).thenReturn(Optional.of(draft));

        assertThrows(ResourceNotFoundException.class, () -> service.save(7L, 15L));
        verify(bookmarkRepository, never()).save(any());
    }

    @Test
    void remove_deletesOnlyUsersOwnBookmark() {
        CourseBookmarkStatusResponse response = service.remove(7L, 15L);

        assertFalse(response.saved());
        assertEquals(15L, response.courseId());
        verify(bookmarkRepository).deleteByUserIdAndCourseId(7L, 15L);
    }

    @Test
    void getSavedCourses_delegatesSavedIdsToCatalogService() {
        List<Long> ids = List.of(15L, 22L);
        PageRequest pageable = PageRequest.of(0, 12);
        CatalogCourseDTO dto = new CatalogCourseDTO(
                15L, "Java 21", "Desc", null, "Teacher", 1L, "Backend",
                CourseLevel.BEGINNER, 5, 600, true, false, 4.5, 2
        );
        Page<CatalogCourseDTO> expected = new PageImpl<>(List.of(dto), pageable, 1);

        when(bookmarkRepository.findSavedCourseIdsByUserId(7L)).thenReturn(ids);
        when(catalogService.searchByIds(ids, "java", 1L, CourseLevel.BEGINNER, pageable, 7L))
                .thenReturn(expected);

        Page<CatalogCourseDTO> actual = service.getSavedCourses(7L, "java", 1L, CourseLevel.BEGINNER, pageable);

        assertEquals(1, actual.getTotalElements());
        assertEquals(15L, actual.getContent().getFirst().id());
    }
}
