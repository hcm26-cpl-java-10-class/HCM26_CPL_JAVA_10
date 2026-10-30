package com.example.starter_project_2025.system.demo.student_score;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface StudentScoreRepository extends BaseCrudRepository<StudentScore, Long> {

    boolean existsByStudentCode(String studentCode);

    Optional<StudentScore> findByStudentCode(String studentCode);
}
