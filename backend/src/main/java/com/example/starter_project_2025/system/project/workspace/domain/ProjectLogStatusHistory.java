package com.example.starter_project_2025.system.project.workspace.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "project_log_status_history", indexes =
        @Index(name = "idx_project_log_history_log_time", columnList = "log_id, changed_at"))
@Getter
@Setter
@NoArgsConstructor
public class ProjectLogStatusHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "log_id", nullable = false, updatable = false)
    private Long logId;

    @Column(name = "actor_id", nullable = false, updatable = false)
    private Long actorId;

    @Column(name = "previous_status", nullable = false, updatable = false, length = 20)
    private String previousStatus;

    @Column(name = "new_status", nullable = false, updatable = false, length = 20)
    private String newStatus;

    @Column(name = "changed_at", nullable = false, updatable = false)
    private Instant changedAt;
}
