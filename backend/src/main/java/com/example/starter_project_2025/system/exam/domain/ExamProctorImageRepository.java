package com.example.starter_project_2025.system.exam.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ExamProctorImageRepository extends JpaRepository<ExamProctorImage, Long> {

    boolean existsByAttemptIdAndEventIdIsNull(Long attemptId);

    Optional<ExamProctorImage> findFirstByAttemptIdAndEventIdIsNullOrderByCapturedAtAsc(Long attemptId);

    List<ExamProctorImage> findAllByEventIdIn(Collection<Long> eventIds);

    long countByAttemptIdAndEventIdIsNotNull(Long attemptId);

    @Query("select i.attemptId from ExamProctorImage i where i.examId = :examId and i.eventId is null")
    List<Long> findAttemptIdsWithEntryPhoto(Long examId);
}
