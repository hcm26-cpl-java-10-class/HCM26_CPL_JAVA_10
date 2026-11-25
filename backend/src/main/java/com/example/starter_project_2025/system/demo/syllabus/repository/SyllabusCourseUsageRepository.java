package com.example.starter_project_2025.system.demo.syllabus.repository;

import com.example.starter_project_2025.system.demo.course.Course;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Locale;
import com.example.starter_project_2025.system.demo.course.CourseStatus;

/** Encapsulates read-only JPQL; never access EntityManager from a Controller. */
@Repository
@RequiredArgsConstructor
public class SyllabusCourseUsageRepository {
    private final EntityManager entityManager;

    /** Search only courses without a syllabus; no course names are duplicated in Syllabus. */
    public List<Course> findUnlinkedCourses(String rawSearch) {
        String search = rawSearch == null ? "" : rawSearch.strip().toLowerCase(Locale.ROOT);
        if (search.length() > 100) {
            search = search.substring(0, 100);
        }
        return entityManager.createQuery("""
                SELECT c FROM Course c
                WHERE c.syllabus IS NULL AND LOWER(c.name) LIKE :keyword
                ORDER BY c.name ASC, c.id ASC
                """, Course.class)
                .setParameter("keyword", "%" + search + "%")
                .setMaxResults(40)
                .getResultList();
    }

    /** Student-facing links must follow the same Published/Active filter as Course Catalog. */
    public List<Course> findPublishedActiveBySyllabus(Long syllabusId) {
        return entityManager.createQuery("""
                SELECT c FROM Course c
                WHERE c.syllabus.id = :syllabusId
                  AND c.status = :published
                  AND c.isActive = true
                ORDER BY c.name ASC, c.id ASC
                """, Course.class)
                .setParameter("syllabusId", syllabusId)
                .setParameter("published", CourseStatus.PUBLISHED)
                .getResultList();
    }

    public List<Course> findLinkedCoursesOrderedByName() {
        return entityManager.createQuery("""
                SELECT c FROM Course c JOIN FETCH c.syllabus s
                ORDER BY c.name ASC
                """, Course.class).getResultList();
    }
}
