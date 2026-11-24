package com.example.starter_project_2025.system.git_integration.github.dto;

/**
 * SY-01: a commit of the GraphQL history of a branch. {@code author} / {@code committer} hold
 * the Git identity (name, e-mail) and, when GitHub could match the e-mail, the GitHub account
 * ({@code login}, {@code databaseId}); the two are kept apart, never assumed to be the same.
 * Dates are ISO-8601 with an offset, as GitHub returns them.
 */
public record GitHubHistoryCommit(
        String oid,
        String message,
        String url,
        String authoredDate,
        String committedDate,
        Integer parentCount,
        Person author,
        Person committer) {

    public record Person(String name, String email, String login, Long databaseId) {
    }
}
