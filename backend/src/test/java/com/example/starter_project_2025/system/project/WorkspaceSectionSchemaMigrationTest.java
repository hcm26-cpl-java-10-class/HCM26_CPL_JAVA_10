package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.project.workspace.config.WorkspaceSectionSchemaMigration;
import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceSection;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.util.Arrays;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WorkspaceSectionSchemaMigrationTest {
    private JdbcTemplate jdbc;
    private WorkspaceSectionSchemaMigration migration;

    @BeforeEach
    void setup() {
        var source = new DriverManagerDataSource("jdbc:h2:mem:workspace-section-" + UUID.randomUUID()
                + ";DB_CLOSE_DELAY=-1", "sa", "");
        jdbc = new JdbcTemplate(source);
        migration = new WorkspaceSectionSchemaMigration(source);
    }

    @AfterEach
    void close() {
        jdbc.execute("SHUTDOWN");
    }

    @Test
    void legacyEnumAcceptsResourcesAndPreservesExistingRowsAndConstraints() throws Exception {
        jdbc.execute("CREATE TABLE workspaces(id BIGINT PRIMARY KEY)");
        jdbc.execute("INSERT INTO workspaces VALUES(1)");
        jdbc.execute("""
                CREATE TABLE workspace_sections(
                  workspace_id BIGINT NOT NULL REFERENCES workspaces(id), display_order INTEGER NOT NULL,
                  section ENUM('ACTIVITY','ARTIFACT','BACKLOG','FEEDBACK','MEMBERS','MILESTONE','OVERVIEW','SPRINT') NOT NULL,
                  PRIMARY KEY(workspace_id,display_order), UNIQUE(workspace_id,section))
                """);
        jdbc.execute("INSERT INTO workspace_sections VALUES(1,0,'OVERVIEW'),(1,1,'MEMBERS'),(1,2,'SPRINT')");
        var before = jdbc.queryForList("SELECT * FROM workspace_sections ORDER BY display_order");
        assertThatThrownBy(() -> jdbc.update("INSERT INTO workspace_sections VALUES(1,3,'RESOURCES')"))
                .isInstanceOf(DataIntegrityViolationException.class);

        migration.run();
        migration.run();

        assertThat(jdbc.queryForList("SELECT * FROM workspace_sections ORDER BY display_order")).isEqualTo(before);
        jdbc.update("INSERT INTO workspace_sections VALUES(1,3,'RESOURCES')");
        assertThat(jdbc.queryForObject("SELECT section FROM workspace_sections WHERE display_order=3", String.class))
                .isEqualTo("RESOURCES");
        assertThatThrownBy(() -> jdbc.update("INSERT INTO workspace_sections VALUES(1,4,'RESOURCES')"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("INSERT INTO workspace_sections VALUES(999,4,'RESOURCES')"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("INSERT INTO workspace_sections VALUES(1,4,'INVALID')"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("INSERT INTO workspace_sections VALUES(1,4,NULL)"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void currentEnumRemainsUnchangedWhenRunAgain() throws Exception {
        String labels = Arrays.stream(WorkspaceSection.values()).map(value -> "'" + value.name() + "'")
                .collect(Collectors.joining(","));
        jdbc.execute("CREATE TABLE workspace_sections(section ENUM(" + labels + "))");
        var before = enumValues();

        migration.run();

        assertThat(enumValues()).isEqualTo(before);
    }

    @Test
    void retainsLabelsWrittenByANewerVersion() throws Exception {
        jdbc.execute("CREATE TABLE workspace_sections(section ENUM('OVERVIEW','FUTURE_SECTION'))");
        jdbc.execute("INSERT INTO workspace_sections VALUES('FUTURE_SECTION')");

        migration.run();

        assertThat(enumValues()).containsAll(Arrays.stream(WorkspaceSection.values()).map(Enum::name).toList());
        assertThat(enumValues()).startsWith("OVERVIEW", "FUTURE_SECTION");
        assertThat(jdbc.queryForObject("SELECT section FROM workspace_sections", String.class)).isEqualTo("FUTURE_SECTION");
    }

    @Test
    void missingTableIsLeftForHibernateToCreate() throws Exception {
        migration.run();

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='PUBLIC'", Long.class))
                .isZero();
    }

    @Test
    void varcharColumnAndItsContentsRemainUnchanged() throws Exception {
        jdbc.execute("CREATE TABLE workspace_sections(section VARCHAR(32) NOT NULL)");
        jdbc.execute("INSERT INTO workspace_sections VALUES('OVERVIEW'),('RESOURCES')");

        migration.run();

        assertThat(jdbc.queryForList("SELECT section FROM workspace_sections ORDER BY section", String.class))
                .containsExactly("OVERVIEW", "RESOURCES");
        assertThat(jdbc.queryForObject("SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='WORKSPACE_SECTIONS' AND COLUMN_NAME='SECTION'", String.class))
                .isEqualTo("CHARACTER VARYING");
    }

    private java.util.List<String> enumValues() {
        return jdbc.queryForList("SELECT VALUE_NAME FROM INFORMATION_SCHEMA.ENUM_VALUES WHERE OBJECT_SCHEMA='PUBLIC'"
                + " AND OBJECT_NAME='WORKSPACE_SECTIONS' ORDER BY CAST(VALUE_ORDINAL AS INTEGER)", String.class);
    }
}
