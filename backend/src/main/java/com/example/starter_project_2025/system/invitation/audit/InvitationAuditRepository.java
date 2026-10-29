package com.example.starter_project_2025.system.invitation.audit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InvitationAuditRepository extends JpaRepository<InvitationAuditLog, Long> {

    List<InvitationAuditLog> findByInvitationIdOrderByCreatedAtDesc(Long invitationId);

    List<InvitationAuditLog> findByExamIdOrderByCreatedAtDesc(Long examId);
}
