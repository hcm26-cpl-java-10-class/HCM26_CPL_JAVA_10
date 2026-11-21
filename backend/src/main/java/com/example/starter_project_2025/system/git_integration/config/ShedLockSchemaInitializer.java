package com.example.starter_project_2025.system.git_integration.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * SY-01: ShedLock does not create its table. Same statement as {@code db/manual/shedlock.sql};
 * valid on H2 and MySQL, and a no-op when the table exists.
 */
@Component
@Order(0)
@RequiredArgsConstructor
public class ShedLockSchemaInitializer implements CommandLineRunner {

    static final String DDL = """
            CREATE TABLE IF NOT EXISTS shedlock (
              name VARCHAR(64) NOT NULL,
              lock_until TIMESTAMP(3) NOT NULL,
              locked_at TIMESTAMP(3) NOT NULL,
              locked_by VARCHAR(255) NOT NULL,
              PRIMARY KEY (name)
            )""";

    private final JdbcTemplate jdbc;

    @Override
    public void run(String... args) {
        jdbc.execute(DDL);
    }
}
