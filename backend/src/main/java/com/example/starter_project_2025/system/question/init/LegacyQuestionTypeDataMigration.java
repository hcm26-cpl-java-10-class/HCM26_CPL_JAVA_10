package com.example.starter_project_2025.system.question.init;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.util.Locale;

@Slf4j
@Component
@Order(-110)
@RequiredArgsConstructor
public class LegacyQuestionTypeDataMigration implements CommandLineRunner {

    private final DataSource dataSource;

    @Override
    public void run(String... args) throws Exception {
        try (Connection connection = dataSource.getConnection()) {
            if (!hasQuestionTable(connection)) {
                return;
            }

            widenLegacyEnumColumn(connection);
            int migrated;
            try (var statement = connection.createStatement()) {
                migrated = statement.executeUpdate(
                        "UPDATE question SET type = 'MULTIPLE_CHOICE' "
                                + "WHERE type IN ('SINGLE_CHOICE', 'MULTI_CHOICE')"
                );
            }

            if (migrated > 0) {
                log.info("Migrated {} legacy questions to MULTIPLE_CHOICE.", migrated);
            }
        }
    }

    private boolean hasQuestionTable(Connection connection) throws Exception {
        DatabaseMetaData metadata = connection.getMetaData();
        try (ResultSet tables = metadata.getTables(connection.getCatalog(), connection.getSchema(),
                metadataName(metadata, "question"), new String[]{"TABLE"})) {
            return tables.next();
        }
    }

    private void widenLegacyEnumColumn(Connection connection) throws Exception {
        DatabaseMetaData metadata = connection.getMetaData();
        String columnType;
        try (ResultSet columns = metadata.getColumns(connection.getCatalog(), connection.getSchema(),
                metadataName(metadata, "question"), metadataName(metadata, "type"))) {
            if (!columns.next()) {
                return;
            }
            columnType = columns.getString("TYPE_NAME");
        }

        String database = connection.getMetaData().getDatabaseProductName();
        try (var statement = connection.createStatement()) {
            if ("H2".equals(database)) {
                statement.execute("ALTER TABLE question ALTER COLUMN type VARCHAR(20)");
            } else if ("MySQL".equals(database) && columnType.toUpperCase(Locale.ROOT).startsWith("ENUM")) {
                statement.execute("ALTER TABLE question MODIFY COLUMN type VARCHAR(20)");
            } else if ("MySQL".equals(database) || !columnType.toUpperCase(Locale.ROOT).startsWith("ENUM")) {
                return;
            } else {
                throw new IllegalStateException(
                        "Cannot migrate legacy ENUM question.type column for database: " + database
                );
            }
        }
    }

    private String metadataName(DatabaseMetaData metadata, String name) throws Exception {
        return metadata.storesUpperCaseIdentifiers()
                ? name.toUpperCase(Locale.ROOT)
                : name.toLowerCase(Locale.ROOT);
    }
}
