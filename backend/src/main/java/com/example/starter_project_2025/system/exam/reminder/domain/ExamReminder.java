package com.example.starter_project_2025.system.exam.reminder.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;
import com.example.starter_project_2025.system.exam.core.domain.Exam;
import com.example.starter_project_2025.system.exam.invitation.domain.Invitation;

@Entity
@Table(name = "exam_reminder")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class ExamReminder extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invitation_id")
    private Invitation invitation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReminderType reminderType;

    @Column(nullable = false)
    private LocalDateTime scheduledAt;

    private LocalDateTime sentAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private ReminderStatus status = ReminderStatus.PENDING;

    @Builder.Default
    @Column(nullable = false)
    private Integer sendAttempts = 0;

    @Column(length = 500)
    private String lastError;

    /**
     * Thời điểm sớm nhất được thử gửi lại reminder đã fail (backoff).
     */
    private LocalDateTime nextRetryAt;

    @Builder.Default
    @Column(nullable = false)
    private Boolean isActive = true;
}
