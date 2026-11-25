package com.example.starter_project_2025.system.git_integration.dto;

import com.example.starter_project_2025.system.git_integration.domain.GitContributorMapSource;
import com.fasterxml.jackson.annotation.JsonIgnore;

import java.time.LocalDateTime;
import java.util.List;

/**
 * GI-06: GitHub accounts of a master project (a module reads its master's): the viewer's own
 * state for the Connect banner, the members with their mapped accounts and activity, and the
 * contributors not mapped to anyone. Activity covers the whole history of the master's repository.
 */
public record GitAccountsOverview(
        GitLinkDetails.ProjectSummary master,
        Viewer viewer,
        List<Member> members,
        List<Unmapped> unmapped,
        Summary summary) {

    /**
     * {@code identity}: the viewer's verified GitHub account (null when Connect has to go
     * through GitHub). {@code mapped}: already mapped in this master project.
     */
    public record Viewer(Long userId, GitAccountConnectResponse.GitAccountView identity, boolean mapped,
                         boolean canConnect, boolean canManage) {
    }

    /** {@code member} is false for a mapped user who no longer belongs to the master or its modules. */
    public record Member(Long userId, String name, String email, List<String> roles, List<GitLinkDetails.ProjectSummary> projects,
                         boolean member, GitHubMapping github, List<EmailMapping> emails, Activity activity) {
    }

    public record GitHubMapping(Long contributorId, String login, GitContributorMapSource source, LocalDateTime mappedAt) {
    }

    public record EmailMapping(Long contributorId, String email, String mappedByName, LocalDateTime mappedAt) {
    }

    /** {@code suggestedUserId} only orders the assign list; nothing is assigned without the PM (BR9). */
    public record Unmapped(Long contributorId, GitContributorView.Kind kind, String login, String email, String displayName,
                           Activity activity, Long suggestedUserId) {
    }

    public record Activity(long commits, long pullRequests, long reviews, LocalDateTime lastActiveAt) {
        public static final Activity NONE = new Activity(0, 0, 0, null);

        @JsonIgnore
        public boolean isEmpty() {
            return commits == 0 && pullRequests == 0 && reviews == 0;
        }

        public Activity plus(Activity other) {
            LocalDateTime last = lastActiveAt == null ? other.lastActiveAt
                    : other.lastActiveAt == null || lastActiveAt.isAfter(other.lastActiveAt) ? lastActiveAt : other.lastActiveAt;
            return new Activity(commits + other.commits, pullRequests + other.pullRequests, reviews + other.reviews, last);
        }
    }

    public record Summary(long members, long connected, long unmappedContributors) {
    }
}
