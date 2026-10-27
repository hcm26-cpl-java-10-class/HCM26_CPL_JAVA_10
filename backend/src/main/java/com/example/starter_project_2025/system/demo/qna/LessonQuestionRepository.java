package com.example.starter_project_2025.system.demo.qna;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface LessonQuestionRepository extends BaseCrudRepository<LessonQuestion, Long> {

    @EntityGraph(attributePaths = "author")
    Page<LessonQuestion> findByLesson_Id(Long lessonId, Pageable pageable);

    @EntityGraph(attributePaths = "author")
    Optional<LessonQuestion> findByIdAndLesson_Id(Long id, Long lessonId);
}