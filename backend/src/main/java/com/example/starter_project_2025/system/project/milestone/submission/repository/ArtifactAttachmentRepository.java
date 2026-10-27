package com.example.starter_project_2025.system.project.milestone.submission.repository;

import com.example.starter_project_2025.system.project.milestone.submission.domain.ArtifactAttachment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ArtifactAttachmentRepository extends JpaRepository<ArtifactAttachment, UUID> {
    List<ArtifactAttachment> findByMilestoneIdAndProjectIdAndTenantIdOrderByUploadedAtAsc(
            UUID milestoneId, Long projectId, Long tenantId);
    List<ArtifactAttachment> findByMilestoneIdAndTeamIdAndTenantIdOrderByUploadedAtAsc(UUID milestoneId, Long teamId, Long tenantId);

    List<ArtifactAttachment> findByIdInAndMilestoneIdAndProjectIdAndTenantIdAndUploadedByAndScanStatus(
            java.util.Collection<UUID> ids, UUID milestoneId, Long projectId, Long tenantId,
            UUID uploadedBy, String scanStatus);
}
