package com.example.starter_project_2025.system.exam.gradebook;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface GradebookScoreRepository extends JpaRepository<GradebookScore, Long> {
    Optional<GradebookScore> findByColumn_IdAndStudent_Id(Long columnId, Long studentId);

    @Query("select s from GradebookScore s where s.column.course.id = :courseId")
    List<GradebookScore> findAllByCourse(@Param("courseId") Long courseId);

    @Modifying
    @Query("delete from GradebookScore s where s.column.id = :columnId")
    void deleteByColumn(@Param("columnId") Long columnId);
}
