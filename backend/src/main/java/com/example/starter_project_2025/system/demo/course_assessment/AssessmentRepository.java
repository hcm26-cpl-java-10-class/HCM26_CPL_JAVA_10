package com.example.starter_project_2025.system.demo.course_assessment;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AssessmentRepository extends BaseCrudRepository<Assessment, Long> {
}
