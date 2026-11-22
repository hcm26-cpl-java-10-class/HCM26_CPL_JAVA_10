package com.example.starter_project_2025.system.git_integration.config;

import com.example.starter_project_2025.system.git_integration.service.GitRepositoryReason;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * GI-05: the former {@code UNAVAILABLE} status of a repository connection is gone. Runs after
 * {@link GitTaskLinkEnumCheckMigration} (which lets the column accept the new values) and before
 * anything reads {@code git_repositories} through JPA (the schedulers start later):
 * <ol>
 *   <li>{@code UNAVAILABLE} → {@code DISCONNECTED} ({@code status_reason = LEGACY_UNAVAILABLE}).</li>
 *   <li>UNAVAILABLE used to free its master project; DISCONNECTED keeps it. The latest such row of a
 *       master gets its {@code active_project_id} back when the master has no current repository;
 *       the others were already replaced and become {@code INACTIVE}.</li>
 * </ol>
 * Idempotent: the new code never writes a DISCONNECTED row without {@code active_project_id}.
 */
@Slf4j
@Component
@Order(2)
@RequiredArgsConstructor
public class GitRepositoryStatusMigration implements CommandLineRunner {

    static final String TABLE = "git_repositories";

    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactions;

    @Override
    public void run(String... args) {
        int[] changed = migrate();
        if (changed[0] + changed[1] + changed[2] > 0) {
            log.info("Git Integration: repository statuses upgraded (UNAVAILABLE→DISCONNECTED: {}, kept as current: {}, →INACTIVE: {})",
                    changed[0], changed[1], changed[2]);
        }
    }

    /** Returns {converted, restored as current, made inactive}. */
    public int[] migrate() {
        if (!tableExists()) return new int[]{0, 0, 0};
        boolean legacy = legacyRows() > 0;
        int[] result = transactions.execute(status -> {
            int converted = !legacy ? 0 : jdbc.update("UPDATE " + TABLE + " SET status = 'DISCONNECTED',"
                    + " status_reason = COALESCE(status_reason, ?), status_changed_at = COALESCE(status_changed_at, updated_at)"
                    + " WHERE status = 'UNAVAILABLE'", GitRepositoryReason.LEGACY_UNAVAILABLE);
            List<Map<String, Object>> orphans = jdbc.queryForList("SELECT id, project_id FROM " + TABLE
                    + " WHERE status = 'DISCONNECTED' AND active_project_id IS NULL ORDER BY id DESC");
            if (orphans.isEmpty()) return new int[]{converted, 0, 0};
            Set<Long> occupied = new HashSet<>(jdbc.queryForList("SELECT active_project_id FROM " + TABLE
                    + " WHERE active_project_id IS NOT NULL", Long.class));
            int restored = 0;
            int inactive = 0;
            for (Map<String, Object> row : orphans) {
                Long id = ((Number) row.get("id")).longValue();
                Long projectId = ((Number) row.get("project_id")).longValue();
                if (occupied.add(projectId)) {
                    restored += jdbc.update("UPDATE " + TABLE + " SET active_project_id = project_id WHERE id = ?", id);
                } else {
                    inactive += jdbc.update("UPDATE " + TABLE + " SET status = 'INACTIVE', active_external_id = NULL,"
                            + " unlinked_at = COALESCE(unlinked_at, status_changed_at) WHERE id = ?", id);
                }
            }
            return new int[]{converted, restored, inactive};
        });
        return result == null ? new int[]{0, 0, 0} : result;
    }

    /**
     * Rows still UNAVAILABLE. A column Hibernate created after GI-05 is a native ENUM without that
     * value, and H2 refuses even to compare with it: then there is none.
     */
    private int legacyRows() {
        try {
            Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM " + TABLE + " WHERE status = 'UNAVAILABLE'", Integer.class);
            return count == null ? 0 : count;
        } catch (DataAccessException notAValue) {
            return 0;
        }
    }

    private boolean tableExists() {
        try {
            jdbc.queryForObject("SELECT COUNT(*) FROM " + TABLE + " WHERE 1 = 0", Integer.class);
            return true;
        } catch (DataAccessException missing) {
            return false;
        }
    }
}
