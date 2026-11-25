package com.example.starter_project_2025.system.demo.progress;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LessonProgressRepository extends BaseCrudRepository<LessonProgress, Long> {

    List<LessonProgress> findAllByEnrollment_Id(Long enrollmentId);

    Optional<LessonProgress> findByEnrollment_IdAndLesson_Id(Long enrollmentId, Long lessonId);
}
