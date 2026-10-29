package com.example.starter_project_2025.system.trainingprogram;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import java.util.Optional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public interface TeachingAssignmentRepository extends JpaRepository<TeachingAssignment, Long>,
        JpaSpecificationExecutor<TeachingAssignment> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from TeachingAssignment a where a.id = :id")
    Optional<TeachingAssignment> findForUpdate(@Param("id") Long id);

    @Query("select distinct a.programSubject.subject from TeachingAssignment a order by a.programSubject.subject.code")
    List<com.example.starter_project_2025.system.subject.Subject> findAssignedSubjects();

    List<TeachingAssignment> findByClassIdOrderByEffectiveFromAscIdAsc(Long classId);

    boolean existsByClassId(Long classId);

    boolean existsByProgramSubject_Id(Long programSubjectId);

    @Query("""
        select case when count(a) > 0 then true else false end
        from TeachingAssignment a join a.teachingSlots s
        where a.trainerId = :trainerId and a.isActive = true
          and (:ignoreId is null or a.id <> :ignoreId)
          and s.date = :date and a.effectiveFrom <= :date
          and (a.effectiveTo is null or a.effectiveTo >= :date)
          and s.startTime < :endTime and s.endTime > :startTime
        """)
    boolean existsTrainerSlotConflict(@Param("trainerId") Long trainerId, @Param("ignoreId") Long ignoreId,
                                      @Param("date") LocalDate date, @Param("startTime") LocalTime startTime,
                                      @Param("endTime") LocalTime endTime);

    @Query("""
            select case when count(a) > 0 then true else false end
            from TeachingAssignment a
            where a.classId = :classId
              and a.programSubject.id = :programSubjectId
              and a.trainerId = :trainerId
              and (:ignoreId is null or a.id <> :ignoreId)
              and (:effectiveTo is null or a.effectiveFrom <= :effectiveTo)
              and (a.effectiveTo is null or a.effectiveTo >= :effectiveFrom)
            """)
    boolean existsOverlappingTrainerAssignment(@Param("classId") Long classId,
                                               @Param("programSubjectId") Long programSubjectId,
                                               @Param("trainerId") Long trainerId,
                                               @Param("effectiveFrom") LocalDate effectiveFrom,
                                               @Param("effectiveTo") LocalDate effectiveTo,
                                               @Param("ignoreId") Long ignoreId);

    @Query("""
            select case when count(a) > 0 then true else false end
            from TeachingAssignment a
            where a.classId = :classId
              and a.programSubject.id = :programSubjectId
              and a.role = :role
              and (:ignoreId is null or a.id <> :ignoreId)
              and (:effectiveTo is null or a.effectiveFrom <= :effectiveTo)
              and (a.effectiveTo is null or a.effectiveTo >= :effectiveFrom)
            """)
    boolean existsOverlappingRoleAssignment(@Param("classId") Long classId,
                                             @Param("programSubjectId") Long programSubjectId,
                                             @Param("role") AssignmentRole role,
                                             @Param("effectiveFrom") LocalDate effectiveFrom,
                                             @Param("effectiveTo") LocalDate effectiveTo,
                                             @Param("ignoreId") Long ignoreId);

    @Query("""
            select case when count(a) > 0 then true else false end
            from TeachingAssignment a
            where a.classId = :classId
              and a.programSubject.id = :programSubjectId
              and a.role = com.example.starter_project_2025.system.trainingprogram.AssignmentRole.MAIN
              and (:ignoreId is null or a.id <> :ignoreId)
              and (:effectiveTo is null or a.effectiveFrom <= :effectiveTo)
              and (a.effectiveTo is null or a.effectiveTo >= :effectiveFrom)
            """)
    boolean existsOverlappingMainAssignment(@Param("classId") Long classId,
                                             @Param("programSubjectId") Long programSubjectId,
                                             @Param("effectiveFrom") LocalDate effectiveFrom,
                                             @Param("effectiveTo") LocalDate effectiveTo,
                                             @Param("ignoreId") Long ignoreId);
}
