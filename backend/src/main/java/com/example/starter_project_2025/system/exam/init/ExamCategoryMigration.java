package com.example.starter_project_2025.system.exam.init;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.DependsOn;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.List;

/**
 * Nang cap database cu: loai bai thi ASSESSMENT duoc doi ten thanh ASSIGNMENT.
 * Cot category cu la kieu ENUM cua database (khong nhan gia tri moi) nen doi sang VARCHAR roi cap nhat du lieu.
 * Chay an toan nhieu lan (idempotent); loi chi duoc ghi log, khong lam hong luc khoi dong.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@DependsOn("entityManagerFactory")
public class ExamCategoryMigration {

    private final DataSource dataSource;

    @PostConstruct
    void migrate() {
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        String product;
        try (Connection c = dataSource.getConnection()) {
            product = c.getMetaData().getDatabaseProductName();
        } catch (Exception e) {
            log.warn("ExamCategoryMigration: cannot read database type: {}", e.getMessage());
            return;
        }
        for (String table : List.of("exam", "exam_template")) {
            try {
                if ("H2".equalsIgnoreCase(product)) {
                    jdbc.execute("ALTER TABLE " + table + " ALTER COLUMN category VARCHAR(30) NOT NULL");
                } else if ("MySQL".equalsIgnoreCase(product) || "MariaDB".equalsIgnoreCase(product)) {
                    jdbc.execute("ALTER TABLE " + table + " MODIFY COLUMN category VARCHAR(30) NOT NULL");
                }
                int n = jdbc.update("UPDATE " + table + " SET category = 'ASSIGNMENT' WHERE category = 'ASSESSMENT'");
                if (n > 0) log.info("ExamCategoryMigration: {} row(s) of {} moved ASSESSMENT -> ASSIGNMENT", n, table);
            } catch (Exception e) {
                log.warn("ExamCategoryMigration skipped for {}: {}", table, e.getMessage());
            }
        }
    }
}
