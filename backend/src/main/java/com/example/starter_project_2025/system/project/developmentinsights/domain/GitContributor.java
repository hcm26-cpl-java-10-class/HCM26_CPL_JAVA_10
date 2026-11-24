package com.example.starter_project_2025.system.project.developmentinsights.domain;

import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.rbac.user.User;
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

/** A Git author/reviewer identity, optionally mapped to a platform user. */
@Entity(name = "ActivityGitContributor")
@Table(name = "git_contributor", indexes = {
        @Index(name = "idx_git_contributor_user", columnList = "user_id")
}, uniqueConstraints = @UniqueConstraint(name = "uk_git_contributor_root_external",
        columnNames = {"root_project_id", "external_id"}))
@Getter
@Setter
@NoArgsConstructor
public class GitContributor {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "root_project_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_git_contributor_root_project"))
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Project rootProject;

    @Column(name = "external_id")
    private Long externalId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_contributor_id", foreignKey = @ForeignKey(name = "fk_activity_source_contributor"))
    private com.example.starter_project_2025.system.git_integration.domain.GitContributor sourceContributor;

    @Column(name = "source_identity_key", length = 320)
    private String sourceIdentityKey;

    @Column(nullable = false, length = 100)
    private String login;

    @Column(name = "display_name", length = 255)
    private String displayName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", foreignKey = @ForeignKey(name = "fk_git_contributor_user"))
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private User user;

    @Column(name = "is_bot", nullable = false)
    private boolean bot;

    public String label() {
        if (displayName != null && !displayName.isBlank()) return displayName;
        return login;
    }
}
