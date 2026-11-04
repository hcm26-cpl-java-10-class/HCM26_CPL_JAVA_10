package com.example.starter_project_2025.system.demo.lessonreport;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface LessonReportRepository extends BaseCrudRepository<LessonReport, Long> {

    @EntityGraph(attributePaths = "reporter")
    Page<LessonReport> findByLesson_Id(Long lessonId, Pageable pageable);

    boolean existsByLesson_IdAndReporter_IdAndStatus(Long lessonId, Long reporterId, LessonReportStatus status);

    @Override
    @EntityGraph(attributePaths = {"reporter", "lesson", "lesson.section", "lesson.section.course"})
    Page<LessonReport> findAll(Specification<LessonReport> spec, Pageable pageable);

    @EntityGraph(attributePaths = {"reporter", "lesson", "lesson.section", "lesson.section.course"})
    Optional<LessonReport> findWithContextById(Long id);
}
