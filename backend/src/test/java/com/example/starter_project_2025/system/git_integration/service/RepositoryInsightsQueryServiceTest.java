package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.repository.GitPullRequestRepository.PullRequestStatRow;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** WS-GH-02: pure parts of the repository insights. */
class RepositoryInsightsQueryServiceTest {

    private static final LocalDateTime T0 = LocalDateTime.of(2026, 11, 1, 8, 0);

    private static PullRequestStatRow merged(long minutes) {
        return new PullRequestStatRow() {
            public String getAuthorLogin() { return "dev"; }
            public Long getAuthorGithubId() { return null; }
            public LocalDateTime getGithubCreatedAt() { return T0; }
            public LocalDateTime getMergedAt() { return T0.plusMinutes(minutes); }
        };
    }

    @Test
    void rangeParsesThePresetsAndDefaultsToThirtyDays() {
        assertThat(InsightsRange.parse(null)).isEqualTo(InsightsRange.D30);
        assertThat(InsightsRange.parse(" ")).isEqualTo(InsightsRange.D30);
        assertThat(InsightsRange.parse("7D")).isEqualTo(InsightsRange.D7);
        assertThat(InsightsRange.parse("90d").key()).isEqualTo("90d");
        assertThat(InsightsRange.parse("6M")).isEqualTo(InsightsRange.M6);
        assertThat(InsightsRange.parse("1y")).isEqualTo(InsightsRange.Y1);
        assertThat(InsightsRange.parse("all")).isEqualTo(InsightsRange.ALL);
        assertThatThrownBy(() -> InsightsRange.parse("365d"))
                .isInstanceOf(GitIntegrationException.class)
                .hasFieldOrPropertyWithValue("code", "GIT_INSIGHTS_RANGE_INVALID");
    }

    @Test
    void medianTimeToMergeIsInHoursWithOneDecimal() {
        assertThat(RepositoryInsightsQueryService.medianHoursToMerge(List.of())).isNull();
        assertThat(RepositoryInsightsQueryService.medianHoursToMerge(List.of(merged(6 * 60), merged(40 * 60), merged(10 * 60))))
                .isEqualTo(10.0);
        assertThat(RepositoryInsightsQueryService.medianHoursToMerge(List.of(merged(60), merged(150)))).isEqualTo(1.8);
    }

    @Test
    void botsAreRecognisedByTheirLoginSuffix() {
        assertThat(RepositoryInsightsQueryService.isBot("dependabot[bot]")).isTrue();
        assertThat(RepositoryInsightsQueryService.isBot("GitHub-Actions[BOT]")).isTrue();
        assertThat(RepositoryInsightsQueryService.isBot("robot-dev")).isFalse();
        assertThat(RepositoryInsightsQueryService.isBot(null)).isFalse();
    }
}
