package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CourseRepository extends BaseCrudRepository<Course, Long> {

    boolean existsByName(String name);

    boolean existsByCategoryId(Long categoryId);

    /** [categoryId, số khóa PUBLISHED + active] cho mỗi danh mục có khóa học. */
    @Query("select c.category.id, count(c) from Course c "
            + "where c.category is not null and c.status = com.example.starter_project_2025.system.demo.course.CourseStatus.PUBLISHED "
            + "and c.isActive = true group by c.category.id")
    List<Object[]> countPublishedByCategory();

    Optional<Course> findByName(String name);
}