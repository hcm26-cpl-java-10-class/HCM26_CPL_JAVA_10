package com.example.starter_project_2025.system.invitation.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "invitations",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_invitation_exam_user", columnNames = {"exam_id", "user_id"})
        }
)
@ResourcePermission("INVITATION")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class Invitation extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private InvitationStatus status = InvitationStatus.PENDING;

    @Column
    private LocalDateTime sentAt;

    @Column(nullable = false)
    @Builder.Default
    private int resendCount = 0;

    @Column
    private LocalDateTime revokedAt;

    @Column(length = 500)
    private String revokedReason;

    @Column
    private LocalDateTime expiresAt;

    @Column(length = 1000)
    private String note;
}
