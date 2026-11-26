package com.example.starter_project_2025.system.project.project_template_version.audit;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ProjectTemplateSnapshotAuditLogDTO {

    Long id;

    Long snapshotId;

    Long templateId;

    Long projectId;

    String action;

    Long actorId;

    String actorEmail;

    String correlationId;

    String beforeState;

    String afterState;

    LocalDateTime createdAt;
}
