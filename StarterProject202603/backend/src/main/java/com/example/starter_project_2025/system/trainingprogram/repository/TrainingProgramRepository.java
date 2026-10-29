package com.example.trainingprogram.repository;

import com.example.trainingprogram.entity.ProgramStatus;
import com.example.trainingprogram.entity.TrainingProgram;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import java.util.Optional;

public interface TrainingProgramRepository extends JpaRepository<TrainingProgram, Long>,
        JpaSpecificationExecutor<TrainingProgram> {
    boolean existsByCodeIgnoreCaseAndVersionIgnoreCase(String code, String version);
    boolean existsByCodeIgnoreCaseAndVersionIgnoreCaseAndIdNot(String code, String version, Long id);
    Optional<TrainingProgram> findByIdAndStatus(Long id, ProgramStatus status);
}
