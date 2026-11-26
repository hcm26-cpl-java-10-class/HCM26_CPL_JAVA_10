package com.example.starter_project_2025.system.project.workspace.dto;

import com.example.starter_project_2025.system.project.workspace.domain.ProjectLog;
import com.example.starter_project_2025.system.project.workspace.domain.ProjectLogTargetType;
import com.example.starter_project_2025.system.project.workspace.domain.ProjectLogType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public final class ProjectLogDtos {
    private ProjectLogDtos() { }

    public record CreateRequest(
            @NotNull ProjectLogType type,
            @NotBlank @Size(max = 100) String title,
            @NotBlank @Size(max = 2000) String content,
            String rationale,
            String impactAnalysis,
            String category,
            String severity,
            @Size(max = 2000) String mitigationPlan,
            Instant meetingDate,
            List<Long> attendees,
            @Size(max = 2000) String actionItems,
            ProjectLogTargetType targetType,
            String targetId
    ) { }

    public record RiskUpdateRequest(
            @NotBlank String status
    ) { }

    public record LogResponse(
            Long id, Long projectId, Long workspaceId, ProjectLogType type, String title, String content,
            String rationale, String impactAnalysis, String category, String severity, String mitigationPlan,
            String status, Instant meetingDate, List<AttendeeResponse> attendees, String actionItems,
            ProjectLogTargetType targetType, String targetId, Long createdBy, String authorName, Instant createdAt,
            Long updatedBy, Instant updatedAt, Long version
    ) {
        public static LogResponse from(ProjectLog log, String authorName, List<AttendeeResponse> attendees) {
            return new LogResponse(log.getId(), log.getProjectId(), log.getWorkspaceId(), log.getType(),
                    log.getTitle(), log.getContent(), log.getRationale(), log.getImpactAnalysis(),
                    log.getCategory(), log.getSeverity(),
                    log.getMitigationPlan(), log.getStatus(), log.getMeetingDate(), attendees,
                    log.getActionItems(), log.getTargetType(), log.getTargetId(), log.getCreatedBy(), authorName,
                    log.getCreatedAt() == null ? null : log.getCreatedAt().toInstant(java.time.ZoneOffset.UTC),
                    log.getUpdatedBy(), log.getUpdatedAt() == null ? null : log.getUpdatedAt().toInstant(java.time.ZoneOffset.UTC),
                    log.getVersion());
        }
    }

    public record LinkOption(String id, String label, ProjectLogTargetType type) { }
    public record AttendeeResponse(Long userId, String name) { }
    public record AuthorOption(Long id, String label, String role) { }
    public record AttendeeOption(Long id, String label, String role) { }
    public record Options(List<LinkOption> milestones, List<LinkOption> tasks, List<LinkOption> backlogItems,
                         List<LinkOption> sprints, List<AuthorOption> authors,
                         List<AttendeeOption> attendees) { }
    public record AuditResponse(Long id, Long logId, Long actorId, Instant timestamp, String correlationId,
                                String ip, String action, String beforeJson, String afterJson) { }
    public record StatusHistoryResponse(Long id, Long logId, Long actorId, String previousStatus,
                                        String newStatus, Instant changedAt) { }
}
