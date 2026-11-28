package com.example.starter_project_2025.system.exam.gradebook;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface GradebookPublishedItemRepository extends JpaRepository<GradebookPublishedItem, Long> {

    boolean existsByCourse_Id(Long courseId);

    List<GradebookPublishedItem> findByCourse_Id(Long courseId);

    List<GradebookPublishedItem> findByCourse_IdAndStudent_IdOrderByPositionAsc(Long courseId, Long studentId);

    @Query("select i from GradebookPublishedItem i where i.course.id in :courseIds and i.student.id in :studentIds "
            + "order by i.position")
    List<GradebookPublishedItem> findForStudents(@Param("courseIds") Collection<Long> courseIds,
                                                 @Param("studentIds") Collection<Long> studentIds);

    /** Cot diem da Save cua course, diem de trong - dung cho sinh vien vao course sau lan Save cuoi. */
    default List<GradebookPublishedItem> templateForCourse(Long courseId) {
        List<GradebookPublishedItem> all = findByCourse_Id(courseId);
        if (all.isEmpty()) return List.of();
        Long first = all.get(0).getStudent().getId();
        return all.stream().filter(i -> i.getStudent().getId().equals(first))
                .sorted(java.util.Comparator.comparingInt(GradebookPublishedItem::getPosition))
                .<GradebookPublishedItem>map(i -> GradebookPublishedItem.builder().course(i.getCourse()).position(i.getPosition())
                        .columnType(i.getColumnType()).columnName(i.getColumnName()).examId(i.getExamId())
                        .examTitle(i.getExamTitle()).weightPercent(i.getWeightPercent()).score(null).build())
                .toList();
    }

    /** Courses in which the student has saved score rows (covers extra students who are not enrolled). */
    @Query("select distinct i.course from GradebookPublishedItem i where i.student.id = :studentId")
    List<com.example.starter_project_2025.system.demo.course.Course> findCoursesOfStudent(@Param("studentId") Long studentId);

    @Modifying
    @Query("delete from GradebookPublishedItem i where i.course.id = :courseId")
    void deleteByCourse(@Param("courseId") Long courseId);
}
