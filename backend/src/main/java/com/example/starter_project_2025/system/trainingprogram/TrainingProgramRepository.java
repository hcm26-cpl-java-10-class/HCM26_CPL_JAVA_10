package com.example.starter_project_2025.system.trainingprogram;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;

public interface TrainingProgramRepository extends JpaRepository<TrainingProgram, Long>, JpaSpecificationExecutor<TrainingProgram> {
    boolean existsByCodeAndVersion(String code, String version);
    Optional<TrainingProgram> findByCodeAndVersion(String code, String version);
}
