package com.example.starter_project_2025.system.project.template.domain.assignment;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.project.template.dto.assignment.AssignmentDtos;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Entity
@Table(name = "project_assignments", uniqueConstraints = @UniqueConstraint(
        name = "uk_project_assignment_request", columnNames = {"tenant_id", "class_id", "idempotency_key"}))
@Data
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@ToString(onlyExplicitlyIncluded = true)
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
    @Column(name = "assigned_at", nullable = false)
    private Instant assignedAt;
    @Column(name = "idempotency_key", nullable = false, updatable = false, length = 100)
    private String idempotencyKey;
    @Column(name = "request_hash", nullable = false, updatable = false, length = 64)
    private String requestHash;
    @Lob
    @Column(name = "request_json")
    private String requestJson;
    @Lob
    @Column(name = "response_json")
    private String responseJson;
}
