package com.example.starter_project_2025.system.git_integration.config;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** SY-04: the SY-03 status column (native ENUM, FAILED/DEAD) is upgraded once and safely. */
class GitWebhookStatusMigrationTest {

    DriverManagerDataSource dataSource;
    JdbcTemplate jdbc;
    GitWebhookStatusMigration migration;

    @BeforeEach
    void database() {
        dataSource = new DriverManagerDataSource("jdbc:h2:mem:sy4-migration-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1", "sa", "");
        jdbc = new JdbcTemplate(dataSource);
        migration = new GitWebhookStatusMigration(dataSource, jdbc);
    }

    @AfterEach
    void shutdown() {
        jdbc.execute("shutdown");
    }

    @Test
    void enumColumnBecomesVarcharAndOldStatesAreRenamed() throws Exception {
        jdbc.execute("create table git_webhook_events(id bigint primary key, "
                + "status enum('RECEIVED','PROCESSING','PROCESSED','IGNORED','FAILED','DEAD') not null)");
        jdbc.update("insert into git_webhook_events values (1,'FAILED'),(2,'DEAD'),(3,'PROCESSED')");

        assertThat(migration.migrate()).isTrue();

        assertThat(statuses()).containsExactly("FAILED_RETRYABLE", "FAILED", "PROCESSED");
        assertThat(jdbc.queryForObject("select data_type from information_schema.columns "
                + "where table_name = 'GIT_WEBHOOK_EVENTS' and column_name = 'STATUS'", String.class))
                .isEqualTo("CHARACTER VARYING");
        jdbc.update("update git_webhook_events set status = 'FAILED_RETRYABLE' where id = 3"); // the new state fits

        // A second run must not turn the new terminal FAILED back into a retryable one.
        assertThat(migration.migrate()).isFalse();
        assertThat(statuses()).containsExactly("FAILED_RETRYABLE", "FAILED", "FAILED_RETRYABLE");
    }

    @Test
    void newDatabasesAreLeftAlone() throws Exception {
        assertThat(migration.migrate()).isFalse(); // no table yet
        jdbc.execute("create table git_webhook_events(id bigint primary key, status varchar(20) not null)");
        jdbc.update("insert into git_webhook_events values (1,'FAILED')");
        assertThat(migration.migrate()).isFalse();
        assertThat(statuses()).containsExactly("FAILED");
    }

    private List<String> statuses() {
        return jdbc.queryForList("select status from git_webhook_events order by id", String.class);
    }
}
