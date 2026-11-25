package com.example.starter_project_2025.system.demo.qna;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface LessonQuestionVoteRepository extends JpaRepository<LessonQuestionVote, Long> {

    Optional<LessonQuestionVote> findByQuestion_IdAndUser_Id(Long questionId, Long userId);

    boolean existsByQuestion_IdAndUser_Id(Long questionId, Long userId);

    long countByQuestion_Id(Long questionId);

    /** Trong số các câu hỏi cho trước, những câu mà người dùng đã upvote. */
    @Query("""
            select v.question.id from LessonQuestionVote v
            where v.user.id = :userId and v.question.id in :questionIds
            """)
    List<Long> findVotedQuestionIds(
            @Param("userId") Long userId,
            @Param("questionIds") Collection<Long> questionIds
    );
}