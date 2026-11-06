package com.example.starter_project_2025.system.exam.domain;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ExamRepository extends BaseCrudRepository<Exam, Long> {
    boolean existsByQuestions_Id(Long questionId);

    /** Bai thi cua mot course (co the loc theo section / lesson); activeOnly=true chi lay bai dang hoat dong. */
    @Query("select e from Exam e where e.course.id = :courseId "
            + "and (:sectionId is null or e.section.id = :sectionId) "
            + "and (:lessonId is null or e.lesson.id = :lessonId) "
            + "and (:activeOnly = false or e.isActive = true) order by e.id")
    java.util.List<Exam> findByCourseLink(@Param("courseId") Long courseId,
                                          @Param("sectionId") Long sectionId,
                                          @Param("lessonId") Long lessonId,
                                          @Param("activeOnly") boolean activeOnly);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from Exam e where e.id = :examId")
    Optional<Exam> lockForAttemptStart(@Param("examId") Long examId);
}