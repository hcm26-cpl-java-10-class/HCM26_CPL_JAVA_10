package com.example.starter_project_2025.system.exam.domain;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ExamAttemptRepository extends BaseCrudRepository<ExamAttempt, Long> {

    Optional<ExamAttempt> findByExam_IdAndStudent_Id(Long examId, Long studentId);

    List<ExamAttempt> findAllByStudent_IdOrderByStartedAtDesc(Long studentId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from ExamAttempt a where a.id = :attemptId and a.student.id = :studentId")
    Optional<ExamAttempt> lockByIdAndStudentId(
            @Param("attemptId") Long attemptId,
            @Param("studentId") Long studentId
    );
}
