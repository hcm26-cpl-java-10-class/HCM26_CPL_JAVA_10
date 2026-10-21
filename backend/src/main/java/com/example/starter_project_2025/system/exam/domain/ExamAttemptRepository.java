package com.example.starter_project_2025.system.exam.domain;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ExamAttemptRepository extends BaseCrudRepository<ExamAttempt, Long> {

    boolean existsByExam_Id(Long examId);

    boolean existsByExam_IdAndStatusIn(Long examId, java.util.Collection<ExamAttemptStatus> statuses);

    Optional<ExamAttempt> findByExam_IdAndStudent_Id(Long examId, Long studentId);

    List<ExamAttempt> findAllByStudent_IdOrderByStartedAtDesc(Long studentId);

    @Query("select a.id from ExamAttempt a where a.status = :status")
    List<Long> findIdsByStatus(@Param("status") ExamAttemptStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from ExamAttempt a where a.id = :attemptId")
    Optional<ExamAttempt> lockById(@Param("attemptId") Long attemptId);

    List<ExamAttempt> findAllByExam_IdAndStudent_IdOrderByAttemptNumberAsc(Long examId, Long studentId);

    List<ExamAttempt> findAllByExam_Id(Long examId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from ExamAttempt a where a.id = :attemptId and a.student.id = :studentId")
    Optional<ExamAttempt> lockByIdAndStudentId(
            @Param("attemptId") Long attemptId,
            @Param("studentId") Long studentId
    );

    @Query("""
            select a from ExamAttempt a
            where a.exam.id = :examId
              and a.status in :statuses
              and exists (select 1 from ExamAttemptQuestion q
                          where q.attempt = a and q.type = :essayType)
            order by a.submittedAt asc, a.id asc
            """)
    List<ExamAttempt> findFinishedWithQuestionType(
            @Param("examId") Long examId,
            @Param("statuses") java.util.Collection<ExamAttemptStatus> statuses,
            @Param("essayType") com.example.starter_project_2025.system.question.domain.QuestionType essayType
    );
}
