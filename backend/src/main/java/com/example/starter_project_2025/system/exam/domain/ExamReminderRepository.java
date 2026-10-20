package com.example.starter_project_2025.system.exam.domain;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface ExamReminderRepository extends BaseCrudRepository<ExamReminder, Long> {

    List<ExamReminder> findByExamId(Long examId);

    List<ExamReminder> findByInvitationId(Long invitationId);

    @Query("SELECT r FROM ExamReminder r WHERE r.status = 'PENDING' AND r.scheduledAt <= :now AND r.isActive = true")
    List<ExamReminder> findPendingRemindersToSend(@Param("now") LocalDateTime now);

    @Query("SELECT r FROM ExamReminder r WHERE r.exam.id = :examId AND r.status = 'PENDING' AND r.isActive = true")
    List<ExamReminder> findActivePendingByExamId(@Param("examId") Long examId);

    @Query("SELECT r FROM ExamReminder r WHERE r.invitation.id = :invitationId AND r.status = 'PENDING' AND r.isActive = true")
    List<ExamReminder> findActivePendingByInvitationId(@Param("invitationId") Long invitationId);
}
