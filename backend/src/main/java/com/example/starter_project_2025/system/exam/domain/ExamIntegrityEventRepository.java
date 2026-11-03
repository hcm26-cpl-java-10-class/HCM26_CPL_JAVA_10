package com.example.starter_project_2025.system.exam.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/** NEW (anti-cheat) */
public interface ExamIntegrityEventRepository extends JpaRepository<ExamIntegrityEvent, Long> {

    List<ExamIntegrityEvent> findAllByExamIdOrderByOccurredAtAsc(Long examId);

    List<ExamIntegrityEvent> findAllByAttemptIdOrderByOccurredAtAsc(Long attemptId);

    long countByAttemptId(Long attemptId);
}
