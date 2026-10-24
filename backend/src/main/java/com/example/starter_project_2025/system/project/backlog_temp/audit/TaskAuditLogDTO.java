package com.example.starter_project_2025.system.project.backlog_temp.audit;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

/**
 * Audit entry returned by {@code GET /api/backlog-items/{id}/audit-logs}.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TaskAuditLogDTO {

    Long id;

    Long taskId;

    Long projectId;

    String action;

    Long actorId;

    String actorEmail;

    String correlationId;

    String beforeState;

    String afterState;

    LocalDateTime createdAt;
}
