package com.example.starter_project_2025.system.project.sprint_backlog.key;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Task ID counter of one (tenant, prefix): the next number to hand out.
 * Workspaces sharing a prefix share the counter, so keys never collide in a tenant.
 */
@Entity
@Table(name = "backlog_task_key_sequence",
        uniqueConstraints = @UniqueConstraint(name = "uk_task_key_seq", columnNames = {"tenant_id", "prefix"}))
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BacklogTaskKeySequence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    @Column(name = "prefix", nullable = false, length = TaskKeyFormat.MAX_PREFIX_LENGTH)
    private String prefix;

    @Column(name = "next_number", nullable = false)
    private Long nextNumber;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    BacklogTaskKeySequence(Long tenantId, String prefix, long nextNumber, LocalDateTime updatedAt) {
        this.tenantId = tenantId;
        this.prefix = prefix;
        this.nextNumber = nextNumber;
        this.updatedAt = updatedAt;
    }
}
