package com.example.starter_project_2025.system.git_integration.config;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** GI-05: the former UNAVAILABLE repository status becomes DISCONNECTED (or INACTIVE when replaced). */
class GitRepositoryStatusMigrationTest {

    DriverManagerDataSource dataSource;
    JdbcTemplate jdbc;
    GitTaskLinkEnumCheckMigration enumMigration;
    GitRepositoryStatusMigration migration;

    @BeforeEach
    void database() {
        dataSource = new DriverManagerDataSource("jdbc:h2:mem:gi5-status-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1", "sa", "");
        jdbc = new JdbcTemplate(dataSource);
        enumMigration = new GitTaskLinkEnumCheckMigration(dataSource);
        migration = new GitRepositoryStatusMigration(jdbc, new TransactionTemplate(new DataSourceTransactionManager(dataSource)));
    }

    @AfterEach
    void shutdown() {
        jdbc.execute("shutdown");
    }

    @Test
    void unavailableRowsBecomeDisconnectedAndTheLatestKeepsItsMaster() throws Exception {
        // As Hibernate created the table before GI-05 (native enum without DISCONNECTED / ERROR).
        jdbc.execute("""
                create table git_repositories(id bigint primary key, project_id bigint not null,
                  status enum('ACTIVE','INACTIVE','UNAVAILABLE') not null,
                  active_project_id bigint unique, active_external_id bigint,
                  status_reason varchar(50), status_changed_at timestamp, unlinked_at timestamp,
                  updated_at timestamp default current_timestamp)""");
        jdbc.update("insert into git_repositories(id, project_id, status) values (1, 10, 'UNAVAILABLE')");
        jdbc.update("insert into git_repositories(id, project_id, status) values (2, 10, 'UNAVAILABLE')"); // newer
        jdbc.update("insert into git_repositories(id, project_id, status) values (3, 20, 'UNAVAILABLE')");
        jdbc.update("insert into git_repositories(id, project_id, status, active_project_id) values (4, 20, 'ACTIVE', 20)");

        assertThat(enumMigration.migrate()).containsExactly("git_repositories.STATUS");
        assertThat(migration.migrate()).containsExactly(3, 1, 2);

        assertThat(status(2)).isEqualTo("DISCONNECTED");
        assertThat(jdbc.queryForObject("select active_project_id from git_repositories where id = 2", Long.class)).isEqualTo(10L);
        assertThat(jdbc.queryForObject("select status_reason from git_repositories where id = 2", String.class))
                .isEqualTo("LEGACY_UNAVAILABLE");
        assertThat(status(1)).isEqualTo("INACTIVE"); // replaced by a newer one
        assertThat(status(3)).isEqualTo("INACTIVE"); // the master already has an ACTIVE repository
        assertThat(status(4)).isEqualTo("ACTIVE");

        assertThat(migration.migrate()).containsExactly(0, 0, 0); // idempotent
    }

    @Test
    void aFreshDatabaseHasNothingToConvert() {
        // Hibernate after GI-05: the enum does not even know UNAVAILABLE.
        jdbc.execute("""
                create table git_repositories(id bigint primary key, project_id bigint not null,
                  status enum('ACTIVE','INACTIVE','DISCONNECTED','ERROR') not null,
                  active_project_id bigint unique, active_external_id bigint,
                  status_reason varchar(50), status_changed_at timestamp, unlinked_at timestamp,
                  updated_at timestamp default current_timestamp)""");

        assertThat(migration.migrate()).containsExactly(0, 0, 0);
    }

    private String status(long id) {
        return jdbc.queryForObject("select status from git_repositories where id = ?", String.class, id);
    }
}
