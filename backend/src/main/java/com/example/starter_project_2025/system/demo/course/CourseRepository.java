package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CourseRepository extends BaseCrudRepository<Course, Long> {

    boolean existsByName(String name);

    boolean existsByCategoryId(Long categoryId);
}
