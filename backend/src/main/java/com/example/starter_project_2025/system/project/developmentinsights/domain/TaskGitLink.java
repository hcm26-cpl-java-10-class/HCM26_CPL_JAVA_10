package com.example.starter_project_2025.system.project.developmentinsights.domain;

import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Check;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

/** A persisted Task-to-Git relationship; task ids use sprint_backlog.sprint_backlog_id. */
@Entity
@Table(name = "task_git_link", indexes = @Index(name = "idx_task_git_link_task", columnList = "task_id"),
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_task_git_link_task_commit", columnNames = {"task_id", "commit_id"}),
                @UniqueConstraint(name = "uk_task_git_link_task_pull_request", columnNames = {"task_id", "pull_request_id"})
        })
@Check(constraints = "(commit_id is not null and pull_request_id is null) or (commit_id is null and pull_request_id is not null)")
@Getter
@Setter
@NoArgsConstructor
public class TaskGitLink {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", nullable = false,
            referencedColumnName = "sprint_backlog_id",
            foreignKey = @ForeignKey(name = "fk_task_git_link_sprint_backlog"))
    @OnDelete(action = OnDeleteAction.CASCADE)
    private SprintBacklog task;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "commit_id", foreignKey = @ForeignKey(name = "fk_task_git_link_commit"))
    @OnDelete(action = OnDeleteAction.CASCADE)
    private GitCommit commit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pull_request_id", foreignKey = @ForeignKey(name = "fk_task_git_link_pull_request"))
    @OnDelete(action = OnDeleteAction.CASCADE)
    private GitPullRequest pullRequest;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private TaskGitLinkSource source = TaskGitLinkSource.AUTO;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "linked_by", foreignKey = @ForeignKey(name = "fk_task_git_link_user"))
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private User linkedBy;

    @Column(name = "linked_at", nullable = false)
    private Instant linkedAt;

    public void confirmManual(User actor, Instant at) {
        this.source = TaskGitLinkSource.MANUAL;
        this.linkedBy = actor;
        this.linkedAt = at;
    }
}
