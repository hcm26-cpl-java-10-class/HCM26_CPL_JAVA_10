package com.example.starter_project_2025.system.exam.gradebook;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface GradebookBonusRepository extends JpaRepository<GradebookBonus, Long> {

    @Query("select b from GradebookBonus b join fetch b.column join fetch b.student "
            + "where b.course.id = :courseId and b.revokedAt is null")
    List<GradebookBonus> findActiveByCourse(@Param("courseId") Long courseId);

    @Query("select b from GradebookBonus b join fetch b.column join fetch b.student "
            + "where b.course.id = :courseId order by b.createdAt desc, b.id desc")
    List<GradebookBonus> findAllByCourse(@Param("courseId") Long courseId);

    @Query("select b from GradebookBonus b where b.column.id = :columnId")
    List<GradebookBonus> findByColumn(@Param("columnId") Long columnId);
}
