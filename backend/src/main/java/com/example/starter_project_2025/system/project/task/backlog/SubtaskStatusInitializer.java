package com.example.starter_project_2025.system.project.task.backlog;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(4)
@RequiredArgsConstructor
public class SubtaskStatusInitializer implements CommandLineRunner {
    private final JdbcTemplate jdbc;

    @Override
    @Transactional
    public void run(String... args) {
        jdbc.update("""
                update task
                   set status = 'IN_PROGRESS', version = version + 1, updated_at = current_timestamp
                 where backlog_item_id is not null and status in ('REVIEW', 'BLOCKED')
                """);
    }
}
