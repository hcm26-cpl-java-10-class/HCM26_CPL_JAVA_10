package com.example.starter_project_2025.system.demo.bookmark;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseLevel;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.course.CourseStatus;
import com.example.starter_project_2025.system.demo.lesson.CatalogCourseDTO;
import com.example.starter_project_2025.system.demo.lesson.CourseCatalogService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Manages per-user saved courses (bookmarks) for published catalog courses.
 */
@Service
@RequiredArgsConstructor
public class CourseBookmarkService {

    private final CourseBookmarkRepository bookmarkRepository;
    private final CourseRepository courseRepository;
    private final CourseCatalogService catalogService;

    @Transactional(readOnly = true)
    public List<Long> getSavedCourseIds(Long userId) {
        return bookmarkRepository.findSavedCourseIdsByUserId(userId);
    }

    @Transactional(readOnly = true)
    public Page<CatalogCourseDTO> getSavedCourses(
            Long userId,
            String search,
            Long categoryId,
            CourseLevel level,
            Pageable pageable
    ) {
        List<Long> savedIds = bookmarkRepository.findSavedCourseIdsByUserId(userId);
        return catalogService.searchByIds(savedIds, search, categoryId, level, pageable, userId);
    }

    @Transactional
    public CourseBookmarkStatusResponse save(Long userId, Long courseId) {
        Course course = courseRepository.findById(courseId)
                .filter(c -> Boolean.TRUE.equals(c.getIsActive()) && c.getStatus() == CourseStatus.PUBLISHED)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found"));

        if (!bookmarkRepository.existsByUserIdAndCourseId(userId, course.getId())) {
            try {
                bookmarkRepository.save(CourseBookmark.builder()
                        .userId(userId)
                        .courseId(course.getId())
                        .build());
            } catch (DataIntegrityViolationException ignored) {
                // Concurrent duplicate save for the same (userId, courseId) is idempotent.
            }
        }
        return new CourseBookmarkStatusResponse(course.getId(), true);
    }

    @Transactional
    public CourseBookmarkStatusResponse remove(Long userId, Long courseId) {
        bookmarkRepository.deleteByUserIdAndCourseId(userId, courseId);
        return new CourseBookmarkStatusResponse(courseId, false);
    }
}
