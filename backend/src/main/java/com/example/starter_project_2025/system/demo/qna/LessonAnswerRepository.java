package com.example.starter_project_2025.system.demo.qna;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface LessonAnswerRepository extends BaseCrudRepository<LessonAnswer, Long> {

    boolean existsByQuestion_Id(Long questionId);

    @EntityGraph(attributePaths = "author")
    List<LessonAnswer> findByQuestion_IdOrderByCreatedAtAscIdAsc(Long questionId);

    @EntityGraph(attributePaths = "author")
    List<LessonAnswer> findByQuestion_IdInOrderByCreatedAtAscIdAsc(Collection<Long> questionIds);

    @EntityGraph(attributePaths = "author")
    Optional<LessonAnswer> findByIdAndQuestion_Id(Long id, Long questionId);
}