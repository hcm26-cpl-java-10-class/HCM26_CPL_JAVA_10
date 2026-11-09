package com.example.starter_project_2025.system.project.milestone.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Relaxes legacy required columns so incomplete milestone drafts can be persisted. */
@Component
@Order(-100)
@RequiredArgsConstructor
public class MilestoneDraftSchemaMigration implements ApplicationRunner {
    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) throws Exception {
        String product;
        try (var connection = jdbc.getDataSource().getConnection()) {
            product = connection.getMetaData().getDatabaseProductName();
        }
        String suffix = product.toLowerCase().contains("h2") ? " SET NULL" : " DROP NOT NULL";
        for (String column : new String[] {"deadline", "rubric_snapshot_id", "late_policy_type"}) {
            jdbc.execute("ALTER TABLE milestones ALTER COLUMN " + column + suffix);
        }
    }
}
