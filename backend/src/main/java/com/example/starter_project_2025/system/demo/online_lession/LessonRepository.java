package com.example.starter_project_2025.system.demo.online_lession;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LessonRepository extends BaseCrudRepository<Lesson, Long> {

    java.util.List<Lesson> findAllByCourse_IdOrderByOrderIndexAsc(Long courseId);
    java.util.List<Lesson> findBySection_IdOrderByOrderIndexAsc(Long sectionId);
    java.util.List<Lesson> findAllByCourse_IdAndIsActiveTrueOrderByOrderIndexAsc(Long courseId);

    boolean existsByCourse_IdAndTitleIgnoreCase(Long courseId, String title);

    boolean existsByCourse_IdAndOrderIndex(Long courseId, Integer orderIndex);

    boolean existsByCourse_IdAndTitleIgnoreCaseAndIdNot(Long courseId, String title, Long id);

    boolean existsByCourse_IdAndOrderIndexAndIdNot(Long courseId, Integer orderIndex, Long id);
}
