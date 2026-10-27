package com.example.starter_project_2025.system.trainingprogram;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.Optional;

public interface ProgramSubjectRepository extends JpaRepository<ProgramSubject, Long> {
    // Lock an existing row before checking overlap, including when no assignments exist yet.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from ProgramSubject p where p.id = :id")
    Optional<ProgramSubject> findForAssignmentById(@Param("id") Long id);

    java.util.List<ProgramSubject> findByProgram_IdOrderByOrderIndexAsc(Long programId);
}
