package com.example.starter_project_2025.system.exam.gradebook;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface GradebookPublishedItemRepository extends JpaRepository<GradebookPublishedItem, Long> {

    boolean existsByCourse_Id(Long courseId);

    List<GradebookPublishedItem> findByCourse_IdAndStudent_IdOrderByPositionAsc(Long courseId, Long studentId);

    @Query("select i from GradebookPublishedItem i where i.course.id in :courseIds and i.student.id in :studentIds "
            + "order by i.position")
    List<GradebookPublishedItem> findForStudents(@Param("courseIds") Collection<Long> courseIds,
                                                 @Param("studentIds") Collection<Long> studentIds);

    @Modifying
    @Query("delete from GradebookPublishedItem i where i.course.id = :courseId")
    void deleteByCourse(@Param("courseId") Long courseId);
}
