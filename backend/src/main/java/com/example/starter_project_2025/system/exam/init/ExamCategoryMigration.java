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
        // Cot type cua exam_integrity_event cung la ENUM: de nhan loai moi (CAMERA_*, HEAD_TURNED) can doi sang VARCHAR
        List<String> typeAlters = "H2".equalsIgnoreCase(product)
                ? List.of("ALTER TABLE exam_integrity_event ALTER COLUMN type VARCHAR(30) NOT NULL",
                          "ALTER TABLE exam_integrity_event ALTER COLUMN type SET DATA TYPE VARCHAR(30)")
                : ("MySQL".equalsIgnoreCase(product) || "MariaDB".equalsIgnoreCase(product))
                    ? List.of("ALTER TABLE exam_integrity_event MODIFY COLUMN type VARCHAR(30) NOT NULL")
                    : List.of();
        for (String sql : typeAlters) {
            try {
                jdbc.execute(sql);
                break;
            } catch (Exception e) {
                log.warn("ExamCategoryMigration: '{}' failed: {}", sql, e.getMessage());
            }
        }
        for (String table : List.of("exam", "exam_template")) {
            // 1) doi cot ENUM cua database sang VARCHAR (neu da la VARCHAR thi khong anh huong)
            List<String> alters = "H2".equalsIgnoreCase(product)
                    ? List.of("ALTER TABLE " + table + " ALTER COLUMN category VARCHAR(30) NOT NULL",
                              "ALTER TABLE " + table + " ALTER COLUMN category SET DATA TYPE VARCHAR(30)")
                    : ("MySQL".equalsIgnoreCase(product) || "MariaDB".equalsIgnoreCase(product))
                        ? List.of("ALTER TABLE " + table + " MODIFY COLUMN category VARCHAR(30) NOT NULL")
                        : List.of();
            for (String sql : alters) {
                try {
                    jdbc.execute(sql);
                    break;
                } catch (Exception e) {
                    log.warn("ExamCategoryMigration: '{}' failed: {}", sql, e.getMessage());
                }
            }
            // 2) doi du lieu ASSESSMENT -> ASSIGNMENT (ke ca bai thi mau)
            try {
                int n = jdbc.update("UPDATE " + table + " SET category = 'ASSIGNMENT' WHERE category = 'ASSESSMENT'");
                log.info("ExamCategoryMigration: {} row(s) of {} moved ASSESSMENT -> ASSIGNMENT", n, table);
            } catch (Exception e) {
                log.warn("ExamCategoryMigration: update of {} failed: {}", table, e.getMessage());
            }
        }
    }
}
