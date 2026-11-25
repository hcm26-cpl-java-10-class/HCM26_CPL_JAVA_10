package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.GitSyncHistorySource;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncHistoryStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncHistoryType;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobType;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Set;

/**
 * SY-06: the synchronization history of repository connections, read from two tables in one
 * ordered page: sync jobs ({@code git_sync_jobs}) and webhook deliveries that carry Git data
 * ({@code git_webhook_events} of type push / pull_request / pull_request_review, never IGNORED).
 * Plain SQL ({@code UNION ALL}) so it runs the same on H2 and MySQL.
 */
@Repository
@RequiredArgsConstructor
public class GitSyncHistoryRepository {

    /** Webhook deliveries that synchronize Git data; configuration events are not part of the history. */
    public static final Set<String> DATA_EVENT_TYPES = Set.of("push", "pull_request", "pull_request_review");

    private final NamedParameterJdbcTemplate jdbc;

    /** Filters; null = any. */
    public record Filter(Collection<Long> repositoryIds, GitSyncHistoryType type, GitSyncHistoryStatus status) {
    }

    /** One row of either table, columns aligned. */
    public record Row(GitSyncHistorySource source, Long id, Long repositoryId, String rawType, String rawStatus,
                      LocalDateTime occurredAt, LocalDateTime startedAt, LocalDateTime finishedAt, int attempts,
                      LocalDateTime nextRunAt, String errorCode, String error, String statsJson,
                      Integer recordsProcessed, boolean partial, String action, boolean payloadAvailable) {
    }

    public List<Row> page(Filter filter, int page, int size) {
        MapSqlParameterSource params = params(filter);
        params.addValue("limit", size).addValue("offset", (long) page * size);
        String sql = "SELECT * FROM (" + union(filter) + ") h ORDER BY h.occurred_at DESC, h.source DESC, h.id DESC"
                + " LIMIT :limit OFFSET :offset";
        return jdbc.query(sql, params, (rs, i) -> row(rs));
    }

    /** One entry, when it belongs to one of {@code repositoryIds}. */
    public java.util.Optional<Row> one(Collection<Long> repositoryIds, GitSyncHistorySource source, Long id) {
        Filter filter = new Filter(repositoryIds, null, null);
        MapSqlParameterSource params = params(filter).addValue("source", source.name()).addValue("id", id);
        return jdbc.query("SELECT * FROM (" + union(filter) + ") h WHERE h.source = :source AND h.id = :id", params,
                (rs, i) -> row(rs)).stream().findFirst();
    }

    public long count(Filter filter) {
        Long count = jdbc.queryForObject("SELECT COUNT(*) FROM (" + union(filter) + ") h", params(filter), Long.class);
        return count == null ? 0 : count;
    }

    private static MapSqlParameterSource params(Filter filter) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("repositoryIds", filter.repositoryIds())
                .addValue("eventTypes", DATA_EVENT_TYPES);
        if (filter.type() != null) params.addValue("jobType", jobType(filter.type()).name());
        return params;
    }

    private static String union(Filter filter) {
        List<String> parts = new ArrayList<>(2);
        parts.add("SELECT 'JOB' AS source, j.id, j.repository_id, j.type AS raw_type, j.status AS raw_status,"
                + " COALESCE(j.started_at, j.created_at) AS occurred_at, j.started_at, j.finished_at,"
                + " j.attempt_count AS attempts, j.next_run_at, j.error_code, NULL AS error,"
                + " j.stats_json, NULL AS records_processed, 0 AS partial_flag,"
                + " NULL AS action, 0 AS payload_available"
                + " FROM git_sync_jobs j WHERE j.repository_id IN (:repositoryIds)"
                + (filter.type() != null ? " AND j.type = :jobType" : "")
                + jobStatus(filter.status()));
        if (filter.type() == null || filter.type() == GitSyncHistoryType.WEBHOOK) {
            parts.add("SELECT 'WEBHOOK' AS source, e.id, e.repository_ref, e.event_type, e.status,"
                    + " e.received_at, e.processing_started_at, e.processed_at,"
                    + " e.attempts, e.next_attempt_at, NULL, e.last_error,"
                    + " NULL, e.records_processed,"
                    + " CASE WHEN e.partial_result = TRUE THEN 1 ELSE 0 END,"
                    + " e.action, CASE WHEN e.payload IS NULL THEN 0 ELSE 1 END"
                    + " FROM git_webhook_events e WHERE e.repository_ref IN (:repositoryIds)"
                    + " AND e.event_type IN (:eventTypes) AND e.status <> 'IGNORED'"
                    + webhookStatus(filter.status()));
        }
        return String.join(" UNION ALL ", parts);
    }

    /** BR4 status → job states (see {@link GitSyncHistoryStatus}). */
    private static String jobStatus(GitSyncHistoryStatus status) {
        if (status == null) return "";
        return switch (status) {
            case PENDING -> " AND j.status = 'PENDING' AND j.attempt_count = 0";
            case PROCESSING -> " AND (j.status = 'RUNNING' OR (j.status = 'PENDING' AND j.attempt_count > 0))";
            case SUCCESS -> " AND j.status = 'SUCCEEDED'";
            case PARTIAL_SUCCESS -> " AND j.status = 'PARTIAL'";
            case FAILED -> " AND j.status = 'FAILED'";
        };
    }

    private static String webhookStatus(GitSyncHistoryStatus status) {
        if (status == null) return "";
        return switch (status) {
            case PENDING -> " AND e.status = 'RECEIVED'";
            case PROCESSING -> " AND e.status IN ('PROCESSING', 'FAILED_RETRYABLE')";
            case SUCCESS -> " AND e.status = 'PROCESSED' AND (e.partial_result IS NULL OR e.partial_result = FALSE)";
            case PARTIAL_SUCCESS -> " AND e.status = 'PROCESSED' AND e.partial_result = TRUE";
            case FAILED -> " AND e.status = 'FAILED'";
        };
    }

    private static GitSyncJobType jobType(GitSyncHistoryType type) {
        return switch (type) {
            case INITIAL -> GitSyncJobType.INITIAL;
            case MANUAL -> GitSyncJobType.MANUAL;
            case RECONCILE -> GitSyncJobType.SCHEDULED;
            case WEBHOOK -> GitSyncJobType.WEBHOOK;
        };
    }

    private static Row row(ResultSet rs) throws SQLException {
        int records = rs.getInt("records_processed");
        Integer recordsProcessed = rs.wasNull() ? null : records;
        return new Row(GitSyncHistorySource.valueOf(rs.getString("source")), rs.getLong("id"), rs.getLong("repository_id"),
                trim(rs.getString("raw_type")), trim(rs.getString("raw_status")), time(rs, "occurred_at"), time(rs, "started_at"),
                time(rs, "finished_at"), rs.getInt("attempts"), time(rs, "next_run_at"), rs.getString("error_code"),
                rs.getString("error"), rs.getString("stats_json"), recordsProcessed, rs.getInt("partial_flag") == 1,
                rs.getString("action"), rs.getInt("payload_available") == 1);
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }

    private static LocalDateTime time(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toLocalDateTime();
    }
}
