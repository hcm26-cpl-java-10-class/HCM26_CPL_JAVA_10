package com.example.starter_project_2025.system.demo.learningpath;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LearningPathCourseRepository extends JpaRepository<LearningPathCourse, Long> {

    @Query("select pc from LearningPathCourse pc join fetch pc.course where pc.path.id = :pathId order by pc.position")
    List<LearningPathCourse> findAllByPathId(@Param("pathId") Long pathId);

    @Modifying
    @Query("delete from LearningPathCourse pc where pc.path.id = :pathId")
    void deleteAllByPathId(@Param("pathId") Long pathId);
}
