package com.example.starter_project_2025.system.demo.progress;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LessonProgressRepository extends BaseCrudRepository<LessonProgress, Long> {

    List<LessonProgress> findAllByEnrollment_IdOrderByLessonIdAsc(Long enrollmentId);

    Optional<LessonProgress> findByEnrollment_IdAndLessonId(Long enrollmentId, Long lessonId);
}
