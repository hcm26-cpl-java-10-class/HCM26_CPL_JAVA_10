package com.example.starter_project_2025.system.exam.audit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Nhật ký thao tác trên lời mời.
 *
 * <p>Bảng riêng {@code exam_invitation_audit_log} (không dùng chung với bảng
 * {@code invitation_audit_logs} của nhóm khác để tránh trùng schema khi merge).
 */
@Entity
@Table(name = "exam_invitation_audit_log", indexes = {
        @Index(name = "idx_inv_audit_exam", columnList = "exam_id"),
        @Index(name = "idx_inv_audit_invitation", columnList = "invitation_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InvitationAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** id lời mời liên quan (null khi thao tác ở mức batch/cả đề). */
    @Column(name = "invitation_id")
    private Long invitationId;

    @Column(name = "exam_id")
    private Long examId;

    /** người nhận lời mời (user id; null với lời mời ẩn danh). */
    @Column(name = "target_user_id")
    private Long targetUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", length = 30, nullable = false)
    private InvitationAuditAction action;

    /** id người thực hiện thao tác. */
    @Column(name = "performed_by")
    private Long performedBy;

    @Column(name = "details", length = 1000)
    private String details;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
