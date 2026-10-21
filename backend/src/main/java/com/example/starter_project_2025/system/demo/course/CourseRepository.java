package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CourseRepository extends BaseCrudRepository<Course, Long> {

    boolean existsByName(String name);

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