package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CourseRepository extends BaseCrudRepository<Course, Long> {

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Course c where c.id = :id")
    Optional<Course> findLockedForAssessment(Long id);

    boolean existsByName(String name);

    boolean existsBySyllabus_Id(Long syllabusId);

    boolean existsByCategories_Id(Long categoryId);

    @Query("""
        select cat.id, count(distinct c.id)
        from Course c
        join c.categories cat
        where c.status = com.example.starter_project_2025.system.demo.course.CourseStatus.PUBLISHED
          and c.isActive = true
        group by cat.id
    """)
    List<Object[]> countPublishedByCategory();

    Optional<Course> findByName(String name);
}