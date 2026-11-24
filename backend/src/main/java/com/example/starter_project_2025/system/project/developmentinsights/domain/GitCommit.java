package com.example.starter_project_2025.system.project.developmentinsights.domain;

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
import java.time.Instant;

import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

/** Immutable source identity with the latest known GitHub commit fields. */
@Entity(name = "ActivityGitCommit")
@Table(name = "git_commit", indexes = {
        @Index(name = "idx_git_commit_time", columnList = "committed_at"),
        @Index(name = "idx_git_commit_author", columnList = "author_contributor_id")
}, uniqueConstraints = @UniqueConstraint(name = "uk_git_commit_repository_sha",
        columnNames = {"repository_id", "sha"}))
@Data
@NoArgsConstructor
public class GitCommit {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "repository_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_git_commit_repository"))
    @OnDelete(action = OnDeleteAction.CASCADE)
    private GitRepository repository;

    @Column(nullable = false, length = 64)
    private String sha;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_contributor_id",
            foreignKey = @ForeignKey(name = "fk_git_commit_author"))
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private GitContributor authorContributor;

    @Column(name = "committed_at", nullable = false)
    private Instant committedAt;

    /** First canonical ingestion, used to select the rule version effective at that time. */
    @Column(name = "source_ingested_at")
    private Instant sourceIngestedAt;

    @Column(name = "html_url", length = 2048)
    private String htmlUrl;

    @Column(name = "first_seen_branch", length = 255)
    private String firstSeenBranch;

    @Column(name = "is_bot", nullable = false)
    private boolean bot;

    @Column(name = "is_merge", nullable = false)
    private boolean mergeCommit;
}
