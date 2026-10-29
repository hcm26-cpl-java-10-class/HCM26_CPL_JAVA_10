package com.example.starter_project_2025.system.project.template.assignment;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "template_search_audit")
@Getter
@NoArgsConstructor
public class TemplateSearchAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long actorId;
    private Long tenantId;
    private Long classId;
    private Long teamId;
    @Column(nullable = false, length = 80)
    private String reason;
    @Column(nullable = false, length = 100)
    private String correlationId;
    @Column(nullable = false)
    private Instant createdAt;

    public TemplateSearchAudit(Long actorId, Long tenantId, Long classId, Long teamId,
            String reason, String correlationId) {
        this.actorId = actorId;
        this.tenantId = tenantId;
        this.classId = classId;
        this.teamId = teamId;
        this.reason = reason;
        this.correlationId = correlationId;
        this.createdAt = Instant.now();
    }
}
