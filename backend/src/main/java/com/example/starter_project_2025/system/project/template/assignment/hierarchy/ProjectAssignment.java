package com.example.starter_project_2025.system.project.template.assignment.hierarchy;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "project_assignments", uniqueConstraints = @UniqueConstraint(
        name = "uk_project_assignment_request", columnNames = {"tenant_id", "class_id", "idempotency_key"}))
@Getter
@Setter
@NoArgsConstructor
public class ProjectAssignment extends BaseEntity {
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;
    @Column(name = "class_id", nullable = false, updatable = false)
    private Long classId;
    @Column(name = "session_id", nullable = false, updatable = false)
    private Long sessionId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 10)
    private AssignmentDtos.Mode mode;
    @Column(name = "source_version_id", nullable = false, updatable = false)
    private Long sourceVersionId;
    @Column(name = "master_project_id")
    private Long masterProjectId;
    @Column(name = "coordinator_team_id", updatable = false)
    private Long coordinatorTeamId;
    @Column(name = "assigned_at", nullable = false, updatable = false)
    private Instant assignedAt;
    @Column(name = "idempotency_key", nullable = false, updatable = false, length = 100)
    private String idempotencyKey;
    @Column(name = "request_hash", nullable = false, updatable = false, length = 64)
    private String requestHash;
    @Lob
    @Column(name = "response_json")
    private String responseJson;
}
