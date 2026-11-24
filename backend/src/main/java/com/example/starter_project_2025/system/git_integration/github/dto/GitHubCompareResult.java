package com.example.starter_project_2025.system.git_integration.github.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * One page of GET /repos/{owner}/{repo}/compare/{base}...{head}. {@code totalCommits}
 * counts every commit of {@code head} not in {@code base}; GitHub returns at most
 * 250 of them without paging. {@code status}: ahead, behind, identical or diverged.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record GitHubCompareResult(
        String status,
        @JsonProperty("ahead_by") Integer aheadBy,
        @JsonProperty("total_commits") Integer totalCommits,
        List<GitHubCommit> commits) {
}
