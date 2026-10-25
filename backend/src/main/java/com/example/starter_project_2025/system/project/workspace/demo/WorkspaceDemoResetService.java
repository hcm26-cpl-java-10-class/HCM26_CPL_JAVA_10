package com.example.starter_project_2025.system.project.workspace.demo;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
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
    private static final int VERSION = 2;
    private final WorkspaceDemoDatasetRepository datasets;
    private final NamedParameterJdbcTemplate jdbc;
    private final EntityManager entityManager;

    public void resetIfOutdated(Long tenantId) {
        if (datasets.findById(tenantId).map(record -> record.getVersion() >= VERSION).orElse(false)) return;
        entityManager.flush();
        var parameters = Map.of("tenant", tenantId, "prefix", "WS-DEMO-%");
        List<Long> teamIds = jdbc.queryForList("SELECT id FROM teams WHERE tenant_id = :tenant AND code LIKE :prefix", parameters, Long.class);
        var projectIds = new HashSet<>(jdbc.queryForList("SELECT id FROM projects WHERE tenant_id = :tenant AND code LIKE :prefix", parameters, Long.class));
        if (!teamIds.isEmpty()) {
            var teamParameters = Map.of("ids", teamIds);
            projectIds.addAll(jdbc.queryForList("SELECT project_id FROM teams WHERE id IN (:ids) AND project_id IS NOT NULL", teamParameters, Long.class));
            var workspaceIds = jdbc.queryForList("SELECT id FROM workspaces WHERE team_id IN (:ids)", teamParameters, Long.class);
            if (!workspaceIds.isEmpty()) {
                var workspaceParameters = Map.of("ids", workspaceIds);
                for (String table : List.of("workspace_creation_requests", "workspace_activities", "workspace_audits", "workspace_outbox_events", "workspace_sections"))
                    jdbc.update("DELETE FROM " + table + " WHERE workspace_id IN (:ids)", workspaceParameters);
                jdbc.update("DELETE FROM workspaces WHERE id IN (:ids)", workspaceParameters);
            }
            jdbc.update("DELETE FROM team_members WHERE team_id IN (:ids)", teamParameters);
            jdbc.update("DELETE FROM teams WHERE id IN (:ids)", teamParameters);
        }
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
        entityManager.clear();
    }

    public void markCurrent(Long tenantId) {
        WorkspaceDemoDataset dataset = datasets.findById(tenantId).orElseGet(WorkspaceDemoDataset::new);
        dataset.setTenantId(tenantId); dataset.setVersion(VERSION);
        datasets.save(dataset);
    }
}
