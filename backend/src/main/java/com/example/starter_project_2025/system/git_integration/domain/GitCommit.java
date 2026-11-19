package com.example.starter_project_2025.system.git_integration.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * SY-04: a commit of a linked repository, ingested from a push webhook. Commits
 * are immutable: one row per (repository connection, SHA), never updated once
 * stored; {@code first_seen_ref} keeps the branch of the first push that brought it.
 * Read by Analytics after {@code CommitIngestedEvent}.
 */
@Entity
@Table(
        name = "git_commits",
        uniqueConstraints = @UniqueConstraint(name = "uk_git_commit_repo_sha", columnNames = {"repository_id", "sha"}),
        indexes = {
                @Index(name = "idx_git_commit_project_time", columnList = "project_id, committed_at"),
                @Index(name = "idx_git_commit_repo_time", columnList = "repository_id, committed_at"),
                @Index(name = "idx_git_commit_repo_author", columnList = "repository_id, author_login, committed_at"),
                // WS-GH-02: branches of a repository (group by first_seen_ref, latest commit).
                @Index(name = "idx_git_commit_repo_ref", columnList = "repository_id, first_seen_ref, committed_at")
        })
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class GitCommit extends BaseEntity {

    @Column(name = "tenant_id", nullable = false)
    Long tenantId;

    /** {@code git_repositories.project_id} (master project) when the commit was ingested. */
    @Column(name = "project_id", nullable = false)
    Long projectId;

    /** {@code git_repositories.id}: the repository connection. */
    @Column(name = "repository_id", nullable = false)
    Long repositoryId;

    @Column(name = "repo_external_id", nullable = false)
    Long repoExternalId;

    @Column(name = "sha", nullable = false, length = 64)
    String sha;

    /** Full message, truncated to the column size. */
    @Column(name = "message", length = 4000)
    String message;

    @Column(name = "author_name")
    String authorName;

    @Column(name = "author_email")
    String authorEmail;

    /** GitHub login; NULL when the author e-mail is not linked to a GitHub account. */
    @Column(name = "author_login", length = 100)
    String authorLogin;

    /** GitHub user id; only known when the commit was read from the API. */
    @Column(name = "author_github_id")
    Long authorGithubId;

    @Column(name = "committer_name")
    String committerName;

    @Column(name = "committer_email")
    String committerEmail;

    @Column(name = "committer_login", length = 100)
    String committerLogin;

    @Column(name = "authored_at")
    LocalDateTime authoredAt;

    @Column(name = "committed_at", nullable = false)
    LocalDateTime committedAt;

    @Column(name = "html_url", length = 500)
    String htmlUrl;

    /** {@code ref} of the push that first brought this commit, e.g. {@code refs/heads/main}. Never updated. */
    @Column(name = "first_seen_ref", nullable = false)
    String firstSeenRef;

    /** added + removed + modified files listed in the push payload; NULL when read from the API. */
    @Column(name = "files_changed")
    Integer filesChanged;

    /** Number of parents (more than 1 = merge commit); only known when read from the API. */
    @Column(name = "parent_count")
    Integer parentCount;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "source", nullable = false, length = 20)
    GitCommitSource source;

    /** {@code git_webhook_events.id} that brought the commit. */
    @Column(name = "ingested_event_id", nullable = false)
    Long ingestedEventId;

    @Column(name = "ingested_at", nullable = false)
    LocalDateTime ingestedAt;
}
