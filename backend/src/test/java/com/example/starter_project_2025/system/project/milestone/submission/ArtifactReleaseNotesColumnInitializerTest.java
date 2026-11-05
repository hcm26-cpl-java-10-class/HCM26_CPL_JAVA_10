package com.example.starter_project_2025.system.project.milestone.submission;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.sql.Types;

import static org.assertj.core.api.Assertions.assertThat;

class ArtifactReleaseNotesColumnInitializerTest {
    @Test
    void widensLegacyReleaseNotesColumnsWithoutLosingExistingValues() throws Exception {
        var dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:release_notes_migration;DB_CLOSE_DELAY=-1", "sa", "");
        dataSource.setDriverClassName("org.h2.Driver");
        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            statement.execute("CREATE TABLE milestone_artifact_drafts (release_notes VARCHAR(10000))");
            statement.execute("CREATE TABLE milestone_artifact_submissions (release_notes VARCHAR(10000))");
            statement.execute("INSERT INTO milestone_artifact_drafts VALUES ('existing draft')");
            statement.execute("INSERT INTO milestone_artifact_submissions VALUES ('existing submission')");
        }

        new ArtifactReleaseNotesColumnInitializer(dataSource).run();

        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            for (String table : new String[]{"MILESTONE_ARTIFACT_DRAFTS", "MILESTONE_ARTIFACT_SUBMISSIONS"}) {
                try (var columns = connection.getMetaData().getColumns(connection.getCatalog(), connection.getSchema(), table, "RELEASE_NOTES")) {
                    assertThat(columns.next()).isTrue();
                    assertThat(columns.getInt("DATA_TYPE")).isEqualTo(Types.CLOB);
                }
            }
            try (var rows = statement.executeQuery("SELECT release_notes FROM milestone_artifact_drafts")) {
                assertThat(rows.next()).isTrue();
                assertThat(rows.getString(1)).isEqualTo("existing draft");
            }
            try (var rows = statement.executeQuery("SELECT release_notes FROM milestone_artifact_submissions")) {
                assertThat(rows.next()).isTrue();
                assertThat(rows.getString(1)).isEqualTo("existing submission");
            }
        }
    }
}
