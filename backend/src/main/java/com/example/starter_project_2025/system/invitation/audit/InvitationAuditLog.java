package com.example.starter_project_2025.system.invitation.audit;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "invitation_audit_logs")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InvitationAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long invitationId;

    private Long examId;

    private Long userId;

    @Column(nullable = false, length = 50)
    private String action; // CREATE, BATCH_CREATE, RESEND, REVOKE, UPDATE, DELETE

    @Column(nullable = false, length = 150)
    private String performedBy;

    @Column(length = 2000)
    private String details;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
