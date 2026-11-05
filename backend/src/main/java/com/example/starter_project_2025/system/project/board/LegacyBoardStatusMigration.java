package com.example.starter_project_2025.system.project.board;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Keeps existing H2 databases usable after the Kanban workflow was reduced to
 * the four supported statuses ({@code TODO}, {@code IN_PROGRESS},
 * {@code REVIEW}, {@code DONE}).
 * <p>
 * Rows written by the previous workflow may still hold {@code BLOCKED} or one
 * of the removed custom statuses. Those values no longer exist in the Java
 * enums, so they are rewritten to {@code IN_PROGRESS} before any user request
 * reads the rows through Hibernate.
 */
@Slf4j
@Component
@Order(0)
@RequiredArgsConstructor
public class LegacyBoardStatusMigration implements CommandLineRunner {

    private static final String SUPPORTED_STATUSES = "'TODO','IN_PROGRESS','REVIEW','DONE'";

    private final JdbcTemplate jdbc;

    @Override
    @Transactional
    public void run(String... args) {
        normalize("sprint_backlog");
        normalize("sprint_task");
        normalize("task");
    }

    private void normalize(String table) {
        try {
            int updated = jdbc.update("update " + table
                    + " set status = 'IN_PROGRESS' where status not in (" + SUPPORTED_STATUSES + ")");
            if (updated > 0) {
                log.info("Normalized {} legacy board status row(s) in {}", updated, table);
            }
        } catch (DataAccessException ex) {
            log.debug("Skipping legacy board status migration for {}: {}", table, ex.getMessage());
        }
    }
}
