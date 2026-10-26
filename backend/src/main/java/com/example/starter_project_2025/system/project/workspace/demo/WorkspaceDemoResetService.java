package com.example.starter_project_2025.system.project.workspace.demo;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.util.HashSet;
import java.util.List;
import java.util.Map;

/** One-time replacement of this feature's local demo records, scoped by tenant and reserved code. */
@Service @RequiredArgsConstructor
@Transactional(propagation = Propagation.MANDATORY)
public class WorkspaceDemoResetService {
    private static final int VERSION = 4;
    private final WorkspaceDemoDatasetRepository datasets;
    private final NamedParameterJdbcTemplate jdbc;
    private final EntityManager entityManager;

    public void resetIfOutdated(Long tenantId) {
        if (datasets.findById(tenantId).map(record -> record.getVersion() >= VERSION).orElse(false)) return;
        entityManager.flush();
        var parameters = Map.of("tenant", tenantId, "prefix", "WS-DEMO-%");
        List<Long> teamIds = jdbc.queryForList("SELECT id FROM teams WHERE tenant_id = :tenant AND code LIKE :prefix", parameters, Long.class);
        List<Long> canonicalTeamIds = jdbc.queryForList(
                "SELECT pt.id FROM project_teams pt JOIN training_classes tc ON tc.class_id = pt.class_id "
                        + "WHERE tc.tenant_id = :tenant AND tc.code LIKE :prefix",
                parameters, Long.class);
        var projectIds = new HashSet<>(jdbc.queryForList("SELECT id FROM projects WHERE tenant_id = :tenant AND code LIKE :prefix", parameters, Long.class));
        if (!canonicalTeamIds.isEmpty()) {
            var canonicalParameters = Map.of("ids", canonicalTeamIds);
            projectIds.addAll(jdbc.queryForList(
                    "SELECT project_id FROM project_teams WHERE id IN (:ids) AND project_id IS NOT NULL",
                    canonicalParameters, Long.class));
            deleteWorkspaceRows(canonicalTeamIds);
            jdbc.update("DELETE FROM project_members WHERE team_id IN (:ids)", canonicalParameters);
            jdbc.update("DELETE FROM project_teams WHERE id IN (:ids)", canonicalParameters);
        }
        if (!teamIds.isEmpty()) {
            var teamParameters = Map.of("ids", teamIds);
            projectIds.addAll(jdbc.queryForList("SELECT project_id FROM teams WHERE id IN (:ids) AND project_id IS NOT NULL", teamParameters, Long.class));
            deleteWorkspaceRows(teamIds);
            jdbc.update("DELETE FROM team_members WHERE team_id IN (:ids)", teamParameters);
            jdbc.update("DELETE FROM teams WHERE id IN (:ids)", teamParameters);
        }
        jdbc.update("DELETE FROM class_members WHERE class_id IN "
                + "(SELECT class_id FROM training_classes WHERE tenant_id = :tenant AND code LIKE :prefix)", parameters);
        jdbc.update("DELETE FROM team_allocation_sessions WHERE class_id IN "
                + "(SELECT class_id FROM training_classes WHERE tenant_id = :tenant AND code LIKE :prefix)", parameters);
        jdbc.update("DELETE FROM training_classes WHERE tenant_id = :tenant AND code LIKE :prefix", parameters);
        if (!projectIds.isEmpty()) {
            jdbc.update("DELETE FROM project_topic_snapshots s WHERE s.project_id IN (:ids) "
                    + "AND EXISTS (SELECT 1 FROM projects p WHERE p.id = s.project_id AND p.tenant_id = :tenant) "
                    + "AND NOT EXISTS (SELECT 1 FROM teams t WHERE t.project_id = s.project_id) "
                    + "AND NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.project_id = s.project_id)",
                    Map.of("ids", projectIds, "tenant", tenantId));
            jdbc.update("DELETE FROM projects p WHERE p.id IN (:ids) AND p.tenant_id = :tenant "
                    + "AND NOT EXISTS (SELECT 1 FROM teams t WHERE t.project_id = p.id) "
                    + "AND NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.project_id = p.id)",
                    Map.of("ids", projectIds, "tenant", tenantId));
        }
        jdbc.update("DELETE FROM cohorts c WHERE c.tenant_id = :tenant AND c.code LIKE :prefix "
                + "AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.cohort_id = c.id)", parameters);
        migrateH2WorkspaceTeamForeignKey();
        entityManager.clear();
    }

    private void migrateH2WorkspaceTeamForeignKey() {
        boolean h2 = Boolean.TRUE.equals(jdbc.getJdbcTemplate().execute((ConnectionCallback<Boolean>) connection ->
                connection.getMetaData().getDatabaseProductName().equalsIgnoreCase("H2")));
        if (!h2) return;

        Long unresolvedWorkspaces = jdbc.queryForObject(
                "SELECT COUNT(*) FROM workspaces w LEFT JOIN project_teams pt ON pt.id = w.team_id WHERE pt.id IS NULL",
                Map.of(), Long.class);
        if (unresolvedWorkspaces != null && unresolvedWorkspaces > 0) {
            throw new IllegalStateException("Workspace demo migration found " + unresolvedWorkspaces
                    + " workspace(s) that do not reference a ProjectTeam. Preserve and migrate these records before startup.");
        }

        List<String> legacyConstraints = jdbc.queryForList(
                "SELECT tc.CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc "
                        + "JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE k ON tc.CONSTRAINT_NAME = k.CONSTRAINT_NAME "
                        + "AND tc.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA "
                        + "JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc "
                        + "ON rc.CONSTRAINT_CATALOG = tc.CONSTRAINT_CATALOG "
                        + "AND rc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA "
                        + "AND rc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME "
                        + "JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS refc "
                        + "ON refc.CONSTRAINT_CATALOG = rc.UNIQUE_CONSTRAINT_CATALOG "
                        + "AND refc.CONSTRAINT_SCHEMA = rc.UNIQUE_CONSTRAINT_SCHEMA "
                        + "AND refc.CONSTRAINT_NAME = rc.UNIQUE_CONSTRAINT_NAME "
                        + "WHERE tc.TABLE_NAME = 'WORKSPACES' AND tc.CONSTRAINT_TYPE = 'FOREIGN KEY' "
                        + "AND k.COLUMN_NAME = 'TEAM_ID' AND refc.TABLE_NAME = 'TEAMS'",
                Map.of(), String.class);
        for (String constraint : legacyConstraints) {
            jdbc.getJdbcTemplate().execute("ALTER TABLE workspaces DROP CONSTRAINT \"" + constraint.replace("\"", "\"\"") + "\"");
        }

        Long projectTeamConstraint = jdbc.queryForObject(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc "
                        + "JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE k ON tc.CONSTRAINT_NAME = k.CONSTRAINT_NAME "
                        + "AND tc.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA "
                        + "JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc "
                        + "ON rc.CONSTRAINT_CATALOG = tc.CONSTRAINT_CATALOG "
                        + "AND rc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA "
                        + "AND rc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME "
                        + "JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS refc "
                        + "ON refc.CONSTRAINT_CATALOG = rc.UNIQUE_CONSTRAINT_CATALOG "
                        + "AND refc.CONSTRAINT_SCHEMA = rc.UNIQUE_CONSTRAINT_SCHEMA "
                        + "AND refc.CONSTRAINT_NAME = rc.UNIQUE_CONSTRAINT_NAME "
                        + "WHERE tc.TABLE_NAME = 'WORKSPACES' AND tc.CONSTRAINT_TYPE = 'FOREIGN KEY' "
                        + "AND k.COLUMN_NAME = 'TEAM_ID' AND refc.TABLE_NAME = 'PROJECT_TEAMS'",
                Map.of(), Long.class);
        if (projectTeamConstraint == null || projectTeamConstraint == 0) {
            jdbc.getJdbcTemplate().execute("ALTER TABLE workspaces ADD CONSTRAINT fk_workspaces_project_team "
                    + "FOREIGN KEY (team_id) REFERENCES project_teams(id)");
        }
    }

    private void deleteWorkspaceRows(List<Long> teamIds) {
        if (teamIds.isEmpty()) return;
        var workspaceParameters = Map.of("ids", teamIds);
        var workspaceIds = jdbc.queryForList(
                "SELECT id FROM workspaces WHERE team_id IN (:ids)", workspaceParameters, Long.class);
        if (workspaceIds.isEmpty()) return;
        var ids = Map.of("ids", workspaceIds);
        for (String table : List.of("workspace_creation_requests", "workspace_activities", "workspace_audits",
                "workspace_outbox_events", "workspace_sections")) {
            jdbc.update("DELETE FROM " + table + " WHERE workspace_id IN (:ids)", ids);
        }
        jdbc.update("DELETE FROM workspaces WHERE id IN (:ids)", ids);
    }

    public void markCurrent(Long tenantId) {
        WorkspaceDemoDataset dataset = datasets.findById(tenantId).orElseGet(WorkspaceDemoDataset::new);
        dataset.setTenantId(tenantId); dataset.setVersion(VERSION);
        datasets.save(dataset);
    }
}
