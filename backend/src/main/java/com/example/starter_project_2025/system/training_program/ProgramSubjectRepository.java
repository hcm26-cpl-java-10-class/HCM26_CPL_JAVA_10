package com.example.starter_project_2025.system.training_program;

import org.springframework.data.jpa.repository.JpaRepository;

@org.springframework.stereotype.Repository("academicProgramSubjectRepository")
public interface ProgramSubjectRepository extends JpaRepository<ProgramSubject, Long> {
    boolean existsBySubjectId(Long subjectId);
}
