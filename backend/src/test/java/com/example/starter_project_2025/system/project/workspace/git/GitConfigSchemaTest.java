package com.example.starter_project_2025.system.project.workspace.git;

import java.util.UUID;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import static org.assertj.core.api.Assertions.*;

class GitConfigSchemaTest {
    @ParameterizedTest @ValueSource(strings = {"", ";MODE=MySQL"})
    void additiveSchemaPreservesExistingDataAndEnforcesWorkspaceUniqueness(String mode) {
        var dataSource = new DriverManagerDataSource("jdbc:h2:mem:git-schema-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1" + mode, "sa", "");
        var jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("create table workspaces (id bigint primary key)");
        jdbc.update("insert into workspaces(id) values (1)");
        var script = new ResourceDatabasePopulator(new ClassPathResource("db/manual/" + (mode.isEmpty() ? "project-git-configs-h2.sql" : "project-git-configs.sql")));
        script.execute(dataSource); script.execute(dataSource);
        String insert = "insert into project_git_configs(workspace_id,tenant_id,team_id,version,created_at,created_by,updated_at,updated_by) values (?,1,1,1,current_timestamp,1,current_timestamp,1)";
        jdbc.update(insert, 1);
        assertThatThrownBy(() -> jdbc.update(insert, 1)).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update(insert, 999)).isInstanceOf(DataIntegrityViolationException.class);
        assertThat(jdbc.queryForObject("select count(*) from workspaces", Long.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from project_git_configs", Long.class)).isEqualTo(1);
        jdbc.execute("shutdown");
    }
}
