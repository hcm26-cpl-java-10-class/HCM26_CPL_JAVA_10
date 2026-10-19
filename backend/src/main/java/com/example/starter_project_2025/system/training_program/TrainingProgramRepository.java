package com.example.starter_project_2025.system.training_program;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;

public interface TrainingProgramRepository extends JpaRepository<TrainingProgram, Long>,
        JpaSpecificationExecutor<TrainingProgram> {
    boolean existsByCodeAndVersion(String code, Integer version);
    Optional<TrainingProgram> findFirstByCodeOrderByVersionDesc(String code);
}
