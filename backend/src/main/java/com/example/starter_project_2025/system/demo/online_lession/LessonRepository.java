package com.example.starter_project_2025.system.demo.online_lession;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LessonRepository extends BaseCrudRepository<Lesson, Long> {

    boolean existsByCourse_IdAndTitleIgnoreCase(Long courseId, String title);

    boolean existsByCourse_IdAndOrderIndex(Long courseId, Integer orderIndex);

    boolean existsByCourse_IdAndTitleIgnoreCaseAndIdNot(Long courseId, String title, Long id);

    boolean existsByCourse_IdAndOrderIndexAndIdNot(Long courseId, Integer orderIndex, Long id);
}
