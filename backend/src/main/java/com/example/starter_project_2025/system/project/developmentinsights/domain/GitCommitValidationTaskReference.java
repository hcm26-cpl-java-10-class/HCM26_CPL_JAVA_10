package com.example.starter_project_2025.system.project.developmentinsights.domain;

import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

/** Resolved sprint_backlog_id snapshot for a Task ID validation result. */
@Entity
@Table(name = "commit_validation_task_reference",
        indexes = @Index(name = "idx_git_validation_task_result", columnList = "validation_result_id"),
        uniqueConstraints = @UniqueConstraint(name = "uk_git_validation_task_reference",
                columnNames = {"validation_result_id", "task_id"}))
@Getter
@Setter
@NoArgsConstructor
public class GitCommitValidationTaskReference {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "validation_result_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_git_validation_task_result"))
    private GitCommitValidationResult validationResult;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", referencedColumnName = "sprint_backlog_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_git_validation_task_backlog"))
    @OnDelete(action = OnDeleteAction.CASCADE)
    private SprintBacklog task;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_git_validation_task_project"))
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Project project;

    public static GitCommitValidationTaskReference link(GitCommitValidationResult result,
                                                        SprintBacklog task, Project project) {
        GitCommitValidationTaskReference reference = new GitCommitValidationTaskReference();
        reference.validationResult = result;
        reference.task = task;
        reference.project = project;
        return reference;
    }

    public Long getTaskId() { return task == null ? null : task.getId(); }
    public Long getProjectId() { return project == null ? null : project.getId(); }
}
