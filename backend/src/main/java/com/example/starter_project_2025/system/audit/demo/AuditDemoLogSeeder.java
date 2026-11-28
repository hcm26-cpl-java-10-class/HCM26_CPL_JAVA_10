package com.example.starter_project_2025.system.audit.demo;

import com.example.starter_project_2025.system.audit.demo.AuditDemoDataGenerator.Actor;
import com.example.starter_project_2025.system.audit.demo.AuditDemoDataGenerator.Row;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Fills audit_logs with demo history from a start date until now, for testing and SRS screenshots.
 * Off by default. Turn on with APP_SEED_AUDIT_LOGS_ENABLED=true (or app.seed.audit-logs.enabled=true).
 * Re-running replaces the previous demo rows (correlation id starts with "demo-seed-") and never
 * touches real audit rows. Rows are inserted with plain SQL because the entity stamps "now" on save.
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.seed.audit-logs.enabled", havingValue = "true")
public class AuditDemoLogSeeder implements CommandLineRunner {

    private static final Logger LOGGER = LoggerFactory.getLogger(AuditDemoLogSeeder.class);

    private static final String INSERT = "insert into audit_logs "
            + "(actor_id, actor_email, action, entity_type, entity_id, old_value, new_value, "
            + "correlation_id, result, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

    private final JdbcTemplate jdbc;

    @Value("${app.seed.audit-logs.from:2026-10-20}")
    private String from;

    @Value("${app.seed.audit-logs.seed:20261020}")
    private long seed;

    @Override
    public void run(String... args) {
        List<Actor> users = jdbc.query(
                "select id, email from users where email is not null order by id",
                (rs, i) -> new Actor(rs.getLong("id"), rs.getString("email")));

        Actor admin = users.stream().filter(u -> u.email().toLowerCase().startsWith("admin"))
                .findFirst().orElse(new Actor(null, "admin@example.com"));
        List<Actor> teachers = new ArrayList<>(users.stream()
                .filter(u -> u.email().toLowerCase().contains("teacher")).toList());
        List<Actor> students = new ArrayList<>(users.stream()
                .filter(u -> !u.equals(admin) && !teachers.contains(u)).limit(15).toList());

        if (teachers.isEmpty()) {
            teachers.add(new Actor(null, "teacher@example.com"));
        }
        if (students.isEmpty()) {
            students.add(new Actor(null, "student@example.com"));
        }

        int removed = jdbc.update("delete from audit_logs where correlation_id like ?",
                AuditDemoDataGenerator.CORRELATION_PREFIX + "%");

        List<Row> rows = AuditDemoDataGenerator.generate(
                LocalDate.parse(from), LocalDateTime.now(), admin, teachers, students, seed);

        jdbc.batchUpdate(INSERT, rows, 200, (ps, row) -> {
            if (row.actorId() == null) {
                ps.setNull(1, java.sql.Types.BIGINT);
            } else {
                ps.setLong(1, row.actorId());
            }
            ps.setString(2, row.actorEmail());
            ps.setString(3, row.action());
            ps.setString(4, row.entityType());
            ps.setString(5, row.entityId());
            ps.setString(6, row.oldValue());
            ps.setString(7, row.newValue());
            ps.setString(8, row.correlationId());
            ps.setString(9, row.result());
            ps.setTimestamp(10, Timestamp.valueOf(row.createdAt()));
        });

        LOGGER.info("Audit demo logs: replaced {} old rows, inserted {} rows from {}", removed, rows.size(), from);
    }
}
