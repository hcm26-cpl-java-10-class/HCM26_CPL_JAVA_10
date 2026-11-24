package com.example.starter_project_2025.system.project.developmentinsights.domain;

import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** Durable notification, saved atomically with the canonical Git write. */
@Entity
@Table(name = "git_activity_change", indexes = @Index(name = "idx_activity_change_due", columnList = "processed_at,next_attempt_at,id"))
@Getter
@NoArgsConstructor
public class GitActivityChange {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "repository_id", nullable = false, foreignKey = @ForeignKey(name = "fk_activity_change_repository"))
    private GitRepository repository;
    @Column(name = "next_attempt_at", nullable = false)
    private Instant nextAttemptAt;
    @Column(name = "processed_at")
    private Instant processedAt;
    @Column(nullable = false)
    private int attempts;
    @Column(name = "last_error", length = 160)
    private String lastError;

    public static GitActivityChange request(GitRepository repository) {
        var change = new GitActivityChange();
        change.repository = repository;
        change.nextAttemptAt = Instant.now();
        return change;
    }
    public void complete() { processedAt = Instant.now(); lastError = null; }
    public void retry(String errorType) {
        attempts++;
        nextAttemptAt = Instant.now().plusSeconds(Math.min(300, 1L << Math.min(attempts, 8)));
        lastError = errorType;
    }
}
