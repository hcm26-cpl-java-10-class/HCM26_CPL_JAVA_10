package com.example.starter_project_2025.system.git_integration.ingestion;

import com.example.starter_project_2025.system.git_integration.domain.GitCommitSource;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubCommit;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubHistoryCommit;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookFailure;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import static org.assertj.core.api.Assertions.*;

class GitHubPayloadMapperTimestampTest {
    private final GitHubPayloadMapper mapper = new GitHubPayloadMapper(Clock.fixed(
            Instant.parse("2030-01-01T00:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh")));

    @ParameterizedTest @NullAndEmptySource @ValueSource(strings = "invalid-date")
    void malformedPushCannotBecomeAnActivityAtTheCurrentTime(String value) {
        var payload = new ObjectMapper().createObjectNode().put("id", "fixture-sha");
        if (value != null) payload.put("timestamp", value);
        assertThatThrownBy(() -> mapper.pushCommit(payload))
                .isInstanceOfSatisfying(GitWebhookFailure.class, error -> assertThat(error.isRetryable()).isFalse());
    }

    @ParameterizedTest @NullAndEmptySource @ValueSource(strings = "invalid-date")
    void malformedRestTimestampIsAProviderFailure(String value) {
        var commit = new GitHubCommit("fixture-sha", null,
                new GitHubCommit.GitData("feat: fixture", null, new GitHubCommit.Person("Fixture", "fixture@example.test", value)),
                null, null, List.of());
        assertThatThrownBy(() -> mapper.apiCommit(commit, GitCommitSource.LIST_COMMITS_API))
                .isInstanceOfSatisfying(GitHubApiException.class,
                        error -> assertThat(error.getKind()).isEqualTo(GitHubApiException.Kind.UNAVAILABLE));
    }

    @ParameterizedTest @NullAndEmptySource @ValueSource(strings = "invalid-date")
    void historyCannotSubstituteAuthoredDateForMissingCommittedDate(String value) {
        var commit = new GitHubHistoryCommit("fixture-sha", "feat: fixture", null,
                "2026-11-23T00:00:00Z", value, 1, null, null);
        assertThatThrownBy(() -> mapper.historyCommit(commit)).isInstanceOf(GitHubApiException.class);
    }

    @Test void allCommitPathsKeepCommittedDateAndApplyTheBusinessZone() {
        String date = "2026-11-23T17:00:00Z";
        LocalDateTime midnight = LocalDateTime.of(2026, 11, 24, 0, 0);
        assertThat(mapper.pushCommit(new ObjectMapper().createObjectNode().put("id", "fixture-sha")
                .put("timestamp", date)).committedAt()).isEqualTo(midnight);
        var api = new GitHubCommit("fixture-sha", null, new GitHubCommit.GitData("feat: fixture",
                new GitHubCommit.Person("Fixture", null, "2000-01-01T00:00:00Z"),
                new GitHubCommit.Person("Fixture", null, date)), null, null, List.of());
        assertThat(mapper.apiCommit(api, GitCommitSource.LIST_COMMITS_API).committedAt()).isEqualTo(midnight);
        assertThat(mapper.historyCommit(new GitHubHistoryCommit("fixture-sha", "feat: fixture", null,
                "2000-01-01T00:00:00Z", date, 1, null, null)).committedAt()).isEqualTo(midnight);
    }
}
