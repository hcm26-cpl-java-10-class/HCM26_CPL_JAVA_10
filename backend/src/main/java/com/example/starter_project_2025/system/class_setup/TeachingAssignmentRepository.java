package com.example.starter_project_2025.system.class_setup;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface TeachingAssignmentRepository extends BaseCrudRepository<TeachingAssignment, Long> {

    // Provided for BOSS: Check if ProgramSubject is referenced by any teaching assignment
    boolean existsByProgramSubjectId(Long programSubjectId);

    boolean existsByClassId(Long classId);

    boolean existsByClassIdAndIsActiveTrue(Long classId);

    List<TeachingAssignment> findByClassIdAndIsActiveTrue(Long classId);

    // Provided for Tan: Teaching schedule by trainer
    List<TeachingAssignment> findByTrainerIdAndIsActiveTrue(Long trainerId);

    List<TeachingAssignment> findByClassIdAndProgramSubjectIdAndIsActiveTrue(Long classId, Long programSubjectId);

    // Provided for Danh: Available teaching assignments on a specific date for StudySession creation
    @Query("""
        SELECT a FROM TeachingAssignment a
        WHERE a.classId = :classId
          AND a.isActive = true
          AND a.effectiveFrom <= :date
          AND (a.effectiveTo IS NULL OR a.effectiveTo >= :date)
        ORDER BY a.effectiveFrom ASC
    """)
    List<TeachingAssignment> findAvailableAssignments(
            @Param("classId") Long classId,
            @Param("date") LocalDate date
    );

    // Check overlapping assignments for same class, same programSubject, same trainer
    @Query("""
        SELECT a FROM TeachingAssignment a
        WHERE a.classId = :classId
          AND a.programSubjectId = :programSubjectId
          AND a.trainerId = :trainerId
          AND a.isActive = true
          AND (:excludeId IS NULL OR a.id <> :excludeId)
          AND (a.effectiveTo IS NULL OR :fromDate <= a.effectiveTo)
          AND (:toDate IS NULL OR a.effectiveFrom <= :toDate)
    """)
    List<TeachingAssignment> findOverlappingAssignments(
            @Param("classId") Long classId,
            @Param("programSubjectId") Long programSubjectId,
            @Param("trainerId") Long trainerId,
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate,
            @Param("excludeId") Long excludeId
    );
}
