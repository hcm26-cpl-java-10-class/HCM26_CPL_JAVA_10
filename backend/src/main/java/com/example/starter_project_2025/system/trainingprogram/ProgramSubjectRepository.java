package com.example.starter_project_2025.system.trainingprogram;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProgramSubjectRepository extends JpaRepository<ProgramSubject, Long> {
    java.util.List<ProgramSubject> findByProgram_IdOrderByOrderIndexAsc(Long programId);
}
