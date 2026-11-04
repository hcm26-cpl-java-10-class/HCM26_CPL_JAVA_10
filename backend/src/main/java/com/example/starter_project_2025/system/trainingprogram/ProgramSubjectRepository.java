package com.example.starter_project_2025.system.trainingprogram;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ProgramSubjectRepository extends JpaRepository<ProgramSubject, Long> {
    List<ProgramSubject> findByProgram_IdOrderByOrderIndexAsc(Long programId);
    boolean existsBySubject_Id(Long subjectId);
}
