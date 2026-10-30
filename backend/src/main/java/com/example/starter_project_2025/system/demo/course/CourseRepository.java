package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CourseRepository extends BaseCrudRepository<Course, Long> {

    boolean existsByName(String name);

    boolean existsByCode(String code);

    Optional<Course> findByCode(String code);

    List<Course> findBySubjectIdAndIsActiveTrueOrderByNameAsc(Long subjectId);

    List<Course> findByIsActiveTrueOrderByNameAsc();
}
