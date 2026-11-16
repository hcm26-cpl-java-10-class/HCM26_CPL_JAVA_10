package com.example.starter_project_2025.system.git_integration;

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

/** GI-04: the manual deployment scripts run twice and enforce the "one ACTIVE" rules in the database. */
class GitRepositoryLinkSchemaTest {

    private static final String INSERT_REPOSITORY = "insert into git_repositories(is_active,created_at,updated_at,tenant_id,project_id,"
            + "installation_ref,provider,external_id,owner_login,name,full_name,html_url,visibility,status,linked_by_user_id,linked_at,"
            + "active_project_id,active_external_id) values (true,current_timestamp,current_timestamp,1,?,1,'GITHUB',?,'o','n','o/n',"
            + "'https://github.com/o/n','private',?,1,current_timestamp,?,?)";

    @ParameterizedTest
    @ValueSource(strings = {"", ";MODE=MySQL"})
    void scriptsAreRepeatableAndEnforceActiveUniqueness(String mode) throws Exception {
        var dataSource = new DriverManagerDataSource("jdbc:h2:mem:gi4-schema-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1" + mode, "sa", "");
        var jdbc = new JdbcTemplate(dataSource);
        var script = new ResourceDatabasePopulator(new ClassPathResource(
                "db/manual/" + (mode.isEmpty() ? "git-repository-link-h2.sql" : "git-repository-link.sql")));
        script.execute(dataSource);
        script.execute(dataSource);

        jdbc.update(INSERT_REPOSITORY, 10L, 100L, "ACTIVE", 10L, 100L);
        // History rows (NULL active keys) never collide.
        jdbc.update(INSERT_REPOSITORY, 10L, 200L, "INACTIVE", null, null);
        jdbc.update(INSERT_REPOSITORY, 20L, 100L, "UNAVAILABLE", null, null);
        // A second ACTIVE repository on project 10, or repository 100 ACTIVE elsewhere, is refused.
        assertThatThrownBy(() -> jdbc.update(INSERT_REPOSITORY, 10L, 300L, "ACTIVE", 10L, 300L))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update(INSERT_REPOSITORY, 30L, 100L, "ACTIVE", 30L, 100L))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThat(jdbc.queryForObject("select count(*) from git_repositories", Long.class)).isEqualTo(3);

        String insertJob = "insert into git_sync_jobs(is_active,created_at,updated_at,tenant_id,repository_id,type,status,dedupe_key,"
                + "attempt_count,max_attempts,next_run_at) values (true,current_timestamp,current_timestamp,1,1,?,'PENDING',?,0,3,current_timestamp)";
        jdbc.update(insertJob, "INITIAL", "INITIAL:1");
        jdbc.update(insertJob, "MANUAL", null);
        jdbc.update(insertJob, "MANUAL", null);
        assertThatThrownBy(() -> jdbc.update(insertJob, "INITIAL", "INITIAL:1")).isInstanceOf(DataIntegrityViolationException.class);

        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            statement.execute("shutdown");
        }
    }
}
