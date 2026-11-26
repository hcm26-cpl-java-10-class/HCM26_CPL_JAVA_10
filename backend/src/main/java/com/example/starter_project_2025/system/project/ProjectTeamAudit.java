package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "project_team_audit_logs")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ProjectTeamAudit extends BaseEntity {

    @Column(nullable = false, length = 50)
    String action;

    @Column(name = "actor_id", nullable = false)
    Long actorId;

    @Column(name = "class_id", nullable = false)
    Long classId;

    @Column(name = "allocation_session_id", nullable = false)
    Long allocationSessionId;

    @Column(name = "before_state", columnDefinition = "TEXT")
    String beforeState;

    @Column(name = "after_state", nullable = false, columnDefinition = "TEXT")
    String afterState;

    @Column(name = "correlation_id", nullable = false, length = 100)
    String correlationId;
}
