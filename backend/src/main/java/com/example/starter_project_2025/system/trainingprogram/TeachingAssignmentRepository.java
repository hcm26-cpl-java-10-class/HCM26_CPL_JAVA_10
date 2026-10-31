package com.example.starter_project_2025.system.trainingprogram;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface TeachingAssignmentRepository extends JpaRepository<TeachingAssignment, Long>,
        JpaSpecificationExecutor<TeachingAssignment> {
    List<TeachingAssignment> findByClassIdOrderByEffectiveFromAscIdAsc(Long classId);

    boolean existsByClassId(Long classId);

    boolean existsByProgramSubject_Id(Long programSubjectId);

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
