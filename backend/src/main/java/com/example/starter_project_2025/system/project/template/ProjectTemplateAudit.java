package com.example.starter_project_2025.system.project.template;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "project_template_audit")
@Getter
@NoArgsConstructor
public class ProjectTemplateAudit {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, updatable = false)
    private Long tenantId;

    @Column(nullable = false, updatable = false)
    private Long templateId;

    @Column(nullable = false, updatable = false)
    private Long actorId;

    @Column(nullable = false, updatable = false, length = 50)
    private String action;

    @Column(nullable = false, updatable = false)
    private Instant timestamp;

    @Column(updatable = false, columnDefinition = "TEXT")
    private String beforeState;

    @Column(nullable = false, updatable = false, columnDefinition = "TEXT")
    private String afterState;

    @Column(nullable = false, updatable = false, length = 100)
    private String correlationId;

    public ProjectTemplateAudit(Long tenantId, Long templateId, Long actorId, String action,
            String beforeState, String afterState, String correlationId) {
        this.tenantId = tenantId;
        this.templateId = templateId;
        this.actorId = actorId;
        this.action = action;
        this.timestamp = Instant.now();
        this.beforeState = beforeState;
        this.afterState = afterState;
        this.correlationId = correlationId;
    }
}
