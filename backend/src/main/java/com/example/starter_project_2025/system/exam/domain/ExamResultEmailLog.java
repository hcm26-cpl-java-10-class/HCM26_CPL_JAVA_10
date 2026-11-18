package com.example.starter_project_2025.system.exam.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "exam_result_email_log",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_result_email_publication_student",
                        columnNames = {
                                "exam_id",
                                "student_id",
                                "publication_version"
                        }
                )
        }
)
@Getter
@Setter
@NoArgsConstructor
public class ExamResultEmailLog extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    @Column(name = "student_id", nullable = false)
    private Long studentId;

    @Column(name = "recipient_email", nullable = false, length = 320)
    private String recipientEmail;

    @Column(name = "publication_version", nullable = false)
    private LocalDateTime publicationVersion;

    @Enumerated(EnumType.STRING)
    @Column(name = "delivery_status", nullable = false, length = 20)
    private ScoreEmailDeliveryStatus status =
            ScoreEmailDeliveryStatus.PENDING;

    @Column(name = "attempt_count", nullable = false)
    private int attemptCount;

    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    @Column(name = "last_error", length = 1000)
    private String lastError;
}
