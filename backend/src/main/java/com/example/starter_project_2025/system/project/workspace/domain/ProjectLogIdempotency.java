package com.example.starter_project_2025.system.project.workspace.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "project_log_idempotency", uniqueConstraints =
        @UniqueConstraint(name = "uk_project_log_idempotency", columnNames = {"log_id", "actor_id", "idempotency_key"}))
@Getter
@Setter
@NoArgsConstructor
public class ProjectLogIdempotency {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "log_id", nullable = false, updatable = false)
    private Long logId;

    @Column(name = "actor_id", nullable = false, updatable = false)
    private Long actorId;

    @Column(name = "idempotency_key", nullable = false, updatable = false, length = 100)
    private String key;

    @Column(name = "request_hash", nullable = false, updatable = false, length = 64)
    private String requestHash;

    @Column(name = "response_json", nullable = false, columnDefinition = "TEXT")
    private String responseJson;
}
