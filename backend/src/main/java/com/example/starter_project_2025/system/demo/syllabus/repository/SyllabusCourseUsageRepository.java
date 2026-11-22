package com.example.starter_project_2025.system.demo.syllabus.repository;

import com.example.starter_project_2025.system.demo.course.Course;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import java.util.List;

/** Encapsulates read-only JPQL; never access EntityManager from a Controller. */
@Repository
@RequiredArgsConstructor
public class SyllabusCourseUsageRepository {
    private final EntityManager entityManager;

    public List<Course> findLinkedCoursesOrderedByName() {
        return entityManager.createQuery("""
                SELECT c FROM Course c JOIN FETCH c.syllabus s
                ORDER BY c.name ASC
                """, Course.class).getResultList();
    }
}
