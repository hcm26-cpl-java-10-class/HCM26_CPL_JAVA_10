package com.example.starter_project_2025.system.project.milestone.submission.repository;

import com.example.starter_project_2025.system.project.milestone.submission.domain.SubmissionAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SubmissionAuditRepository extends JpaRepository<SubmissionAuditLog, UUID> {
    Optional<SubmissionAuditLog> findBySubmissionIdAndActionAndActorIdAndIdempotencyKey(
            UUID submissionId, String action, UUID actorId, String idempotencyKey);
}
