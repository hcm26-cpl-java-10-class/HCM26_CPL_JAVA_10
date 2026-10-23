package com.example.starter_project_2025.system.exam.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

@Entity
@Table(name = "exam_invitation")
@ResourcePermission("INVITATION")
@ResourceMenu(
        title = "Invitations",
        group = "Exam Management",
        icon = "mail",
        url = "/invitations",
        order = 2,
        permission = "INVITATION_READ"
)
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class Invitation extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(nullable = false, unique = true, length = 64)
    private String token;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private InvitationStatus status = InvitationStatus.PENDING;

    private LocalDateTime sentAt;

    private LocalDateTime expiresAt;

    private LocalDateTime acceptedAt;

    private LocalDateTime rejectedAt;

    private LocalDateTime revokedAt;

    @Column(length = 500)
    private String revokedReason;

    @Column(length = 500)
    private String note;

    @Builder.Default
    @Column(nullable = false)
    private Integer resendCount = 0;

    @Builder.Default
    @Column(nullable = false)
    private Boolean anonymous = false;

    @Column(length = 100)
    private String guestName;

    @Column(length = 150)
    private String guestEmail;

    /**
     * User "khách" được tạo tự động khi học sinh mở link anonymous và nhập
     * tên/email. Dùng để gắn kết quả bài thi về đúng người nhận email.
     */
    @Column(name = "guest_user_id")
    private Long guestUserId;

    @Column(length = 10)
    private String accessCode;

    /** Mốc cuối để mở link (khác {@code expiresAt} là hạn của lời mời). */
    private LocalDateTime maxAccessTime;

    @Builder.Default
    @Column(nullable = false)
    private Integer maxAccessAttempts = 1;

    @Builder.Default
    @Column(nullable = false)
    private Integer accessAttemptCount = 0;
}
