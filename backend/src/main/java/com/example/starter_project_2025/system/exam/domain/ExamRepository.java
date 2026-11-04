package com.example.starter_project_2025.system.exam.domain;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ExamRepository extends BaseCrudRepository<Exam, Long> {
    boolean existsByQuestions_Id(Long questionId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from Exam e where e.id = :examId")
    Optional<Exam> lockForAttemptStart(@Param("examId") Long examId);

    @Query("SELECT e FROM Exam e ORDER BY " +
            "CASE WHEN (e.startTime IS NULL OR e.startTime <= CURRENT_TIMESTAMP) " +
            "     AND (e.endTime IS NULL OR e.endTime >= CURRENT_TIMESTAMP) THEN 0 ELSE 1 END ASC, " +
            "e.id DESC")
    Page<Exam> findAllExamsSortedByOpenStatus(Pageable pageable);

}
