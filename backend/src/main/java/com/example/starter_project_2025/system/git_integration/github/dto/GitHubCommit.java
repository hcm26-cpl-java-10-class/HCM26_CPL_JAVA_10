package com.example.starter_project_2025.system.git_integration.github.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Commit as returned by the Compare and List Commits APIs (only the fields the
 * platform uses). {@code commit} holds the Git data; {@code author} /
 * {@code committer} are the GitHub accounts, NULL when the e-mail is not linked.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record GitHubCommit(
        String sha,
        @JsonProperty("html_url") String htmlUrl,
        GitData commit,
        Account author,
        Account committer,
        List<Parent> parents) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record GitData(String message, Person author, Person committer) {
    }

    /** Git identity with an ISO-8601 {@code date}. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Person(String name, String email, String date) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Account(String login, Long id) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Parent(String sha) {
    }
}
