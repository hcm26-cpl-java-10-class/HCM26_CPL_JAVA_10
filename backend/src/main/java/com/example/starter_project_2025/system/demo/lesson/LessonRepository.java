package com.example.starter_project_2025.system.demo.lesson;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LessonRepository extends BaseCrudRepository<Lesson, Long> {

    List<Lesson> findBySection_IdOrderByOrderIndexAsc(Long sectionId);
}
