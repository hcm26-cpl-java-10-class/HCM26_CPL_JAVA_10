package com.example.starter_project_2025.system.git_integration.config;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** SY-01: git_commits accepts synced commits (no webhook event) and old rows get the new flags, once. */
class GitCommitSyncColumnsMigrationTest {

    DriverManagerDataSource dataSource;
    JdbcTemplate jdbc;
    GitCommitSyncColumnsMigration migration;

    @BeforeEach
    void database() {
        dataSource = new DriverManagerDataSource("jdbc:h2:mem:sy1-commits-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1", "sa", "");
        jdbc = new JdbcTemplate(dataSource);
        migration = new GitCommitSyncColumnsMigration(dataSource, jdbc);
    }

    @AfterEach
    void shutdown() {
        jdbc.execute("shutdown");
    }

    @Test
    void relaxesTheWebhookEventAndBackfillsTheFlagsOnce() throws Exception {
        // As SY-04 created the table, plus the SY-01 columns added by ddl-auto=update.
        jdbc.execute("""
                create table git_commits(id bigint primary key, sha varchar(64),
                  author_login varchar(100), committer_login varchar(100), parent_count int,
                  ingested_event_id bigint not null, is_merge boolean, is_bot boolean)""");
        jdbc.update("insert into git_commits values (1, 'a', 'dev', null, 2, 10, null, null)");
        jdbc.update("insert into git_commits values (2, 'b', 'renovate[bot]', null, 1, 11, null, null)");
        jdbc.update("insert into git_commits values (3, 'c', null, 'github-actions[bot]', null, 12, null, null)");

        assertThat(migration.migrate()).contains("ingested_event_id nullable");

        jdbc.update("insert into git_commits values (4, 'd', 'dev', null, 1, null, false, false)"); // a synced commit
        assertThat(jdbc.queryForList("select is_merge from git_commits order by id", Boolean.class))
                .containsExactly(true, false, null, false);
        assertThat(jdbc.queryForList("select is_bot from git_commits order by id", Boolean.class))
                .containsExactly(false, true, true, false);
        assertThat(migration.migrate()).isEmpty();
    }

    @Test
    void newDatabasesAreLeftAlone() throws Exception {
        assertThat(migration.migrate()).isEmpty();
    }
}
