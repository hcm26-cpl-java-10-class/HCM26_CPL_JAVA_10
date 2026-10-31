package com.example.starter_project_2025.system.trainingprogram;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ClassTrainingProgramRepository extends JpaRepository<ClassTrainingProgram, Long> {
    Optional<ClassTrainingProgram> findByClassId(Long classId);

    boolean existsByProgram_Id(Long programId);
}
