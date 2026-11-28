package com.example.starter_project_2025.system.demo.coursepolicy;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CourseCompletionRuleRepository extends JpaRepository<CourseCompletionRule, Long> {

    Optional<CourseCompletionRule> findByCourse_Id(Long courseId);
}
