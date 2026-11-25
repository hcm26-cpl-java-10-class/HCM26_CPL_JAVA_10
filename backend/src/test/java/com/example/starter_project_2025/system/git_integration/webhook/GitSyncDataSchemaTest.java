package com.example.starter_project_2025.system.git_integration.webhook;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** SY-04: the manual scripts run twice and enforce one commit per SHA, one PR per number, one review per id. */
class GitSyncDataSchemaTest {

    private static final String AUDIT = "is_active,created_at,updated_at,tenant_id,project_id,repository_id";
    private static final String AUDIT_VALUES = "true,current_timestamp,current_timestamp,1,10,100";

    @ParameterizedTest
    @ValueSource(strings = {"", ";MODE=MySQL"})
    void scriptsAreRepeatableAndKeysAreUnique(String mode) throws Exception {
        var dataSource = new DriverManagerDataSource("jdbc:h2:mem:sy4-schema-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1" + mode, "sa", "");
        var jdbc = new JdbcTemplate(dataSource);
        var script = new ResourceDatabasePopulator(new ClassPathResource(
                "db/manual/" + (mode.isEmpty() ? "git-sync-data-h2.sql" : "git-sync-data.sql")));
        script.execute(dataSource);
        script.execute(dataSource);

        String commit = "insert into git_commits(" + AUDIT + ",repo_external_id,sha,committed_at,first_seen_ref,source,"
                + "ingested_event_id,ingested_at) values (" + AUDIT_VALUES + ",9001,?,current_timestamp,'refs/heads/main',"
                + "'WEBHOOK_PAYLOAD',1,current_timestamp)";
        jdbc.update(commit, "a1");
        jdbc.update(commit, "b2");
        assertThatThrownBy(() -> jdbc.update(commit, "a1")).isInstanceOf(DataIntegrityViolationException.class);

        String pr = "insert into git_pull_requests(" + AUDIT + ",repo_external_id,external_id,number,title,state,draft,"
                + "github_created_at,github_updated_at) values (" + AUDIT_VALUES + ",9001,?,?,'t','OPEN',false,"
                + "current_timestamp,current_timestamp)";
        jdbc.update(pr, 5001L, 7);
        assertThatThrownBy(() -> jdbc.update(pr, 5002L, 7)).isInstanceOf(DataIntegrityViolationException.class);
        Long prId = jdbc.queryForObject("select id from git_pull_requests where number = 7", Long.class);

        String review = "insert into git_pull_request_reviews(" + AUDIT + ",pull_request_id,external_id,state,"
                + "source_updated_at,source_action_rank) values (" + AUDIT_VALUES + ",?,?,'APPROVED',current_timestamp,1)";
        jdbc.update(review, prId, 77L);
        assertThatThrownBy(() -> jdbc.update(review, prId, 77L)).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update(review, 999_999L, 78L)).isInstanceOf(DataIntegrityViolationException.class);

        assertThat(jdbc.queryForObject("select count(*) from git_commits", Long.class)).isEqualTo(2);
        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            statement.execute("shutdown");
        }
    }
}
