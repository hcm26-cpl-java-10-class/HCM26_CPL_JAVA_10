package com.example.starter_project_2025.system.demo.coursepolicy;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CoursePrerequisiteRepository extends JpaRepository<CoursePrerequisite, Long> {

    @Query("select p from CoursePrerequisite p join fetch p.prerequisite where p.course.id = :courseId order by p.id")
    List<CoursePrerequisite> findAllByCourseId(@Param("courseId") Long courseId);

    Optional<CoursePrerequisite> findByCourse_IdAndPrerequisite_Id(Long courseId, Long prerequisiteId);

    long countByCourse_Id(Long courseId);

    /** Every edge of the prerequisite graph as {courseId, prerequisiteId}; small table, used for cycle checks. */
    @Query("select p.course.id, p.prerequisite.id from CoursePrerequisite p")
    List<Object[]> findAllEdges();
}
