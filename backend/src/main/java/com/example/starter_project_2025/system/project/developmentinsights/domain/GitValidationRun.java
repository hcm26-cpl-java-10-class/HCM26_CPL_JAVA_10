package com.example.starter_project_2025.system.project.developmentinsights.domain;

import com.example.starter_project_2025.system.project.domain.Project;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** Completed explicit validation request. Replays return the original batch, including empty batches. */
@Entity
@Table(name = "git_validation_run", uniqueConstraints = @UniqueConstraint(
        name = "uk_git_validation_run_key", columnNames = {"root_project_id", "operation_key"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class GitValidationRun {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "root_project_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_git_validation_run_project"))
    private Project rootProject;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_commit_id", foreignKey = @ForeignKey(name = "fk_git_validation_run_commit"))
    private GitCommit targetCommit;

    @Column(name = "operation_key", nullable = false, length = 48)
    private String operationKey;

    @Column(name = "completed_at", nullable = false)
    private Instant completedAt;

    @ManyToMany
    @JoinTable(name = "git_validation_run_result",
            joinColumns = @JoinColumn(name = "run_id", foreignKey = @ForeignKey(name = "fk_git_validation_run_result_run")),
            inverseJoinColumns = @JoinColumn(name = "result_id", foreignKey = @ForeignKey(name = "fk_git_validation_run_result_result")))
    @OrderBy("id ASC")
    private List<GitCommitValidationResult> results = new ArrayList<>();

    public static GitValidationRun completed(Project rootProject, GitCommit targetCommit, String key,
                                              List<GitCommitValidationResult> results) {
        GitValidationRun run = new GitValidationRun();
        run.rootProject = rootProject;
        run.targetCommit = targetCommit;
        run.operationKey = key;
        run.completedAt = Instant.now();
        run.results.addAll(results);
        return run;
    }
}
