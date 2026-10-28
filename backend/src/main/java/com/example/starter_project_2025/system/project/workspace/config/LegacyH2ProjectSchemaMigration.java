package com.example.starter_project_2025.system.project.workspace.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.*;
import java.time.Instant;
import java.util.*;

/**
 * Local H2 compatibility migration. Original rows remain in immutable snapshot tables;
 * only explicit project aliases are converted. Unknown demo UUIDs are quarantined,
 * never attached to an arbitrary tenant/project. Production databases require their
 * normal versioned migration process instead of this H2-specific adapter.
 */
@Slf4j
@Component
public class LegacyH2ProjectSchemaMigration {
    private static final String VERSION = "project-team-v1";
    private final JdbcTemplate jdbc;
    private boolean migratedDatabase;

    public LegacyH2ProjectSchemaMigration(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public boolean isMigratedDatabase() { return migratedDatabase; }

    @PostConstruct
    public void migrate() throws Exception {
        try (var connection = Objects.requireNonNull(jdbc.getDataSource()).getConnection()) {
            if (!"H2".equals(connection.getMetaData().getDatabaseProductName())) return;
            if (table("legacy_project_migrations") && count("legacy_project_migrations", "version_key='" + VERSION + "' AND completed=true") > 0) {
                migratedDatabase = true;
                return;
            }
            boolean oldWorkspaceTeam = importedTeamTable().equals("TEAMS");
            boolean oldMilestone = uuidColumn("milestones", "project_id") || column("milestones", "legacy_project_uuid");
            boolean oldTemplate = column("project_templates", "title") && !column("project_templates", "code");
            boolean oldBacklog = table("sprint_backlog") && !column("sprint_backlog", "work_type");
            if (!oldWorkspaceTeam && !oldMilestone && !oldTemplate && !oldBacklog) return;

            backup(connection.getMetaData().getURL());
            jdbc.execute("CREATE TABLE IF NOT EXISTS legacy_project_migrations (version_key VARCHAR(100) PRIMARY KEY, completed BOOLEAN NOT NULL, started_at TIMESTAMP WITH TIME ZONE NOT NULL, completed_at TIMESTAMP WITH TIME ZONE)");
            if (count("legacy_project_migrations", "version_key='" + VERSION + "'") == 0)
                jdbc.update("INSERT INTO legacy_project_migrations(version_key,completed,started_at) VALUES (?,false,?)", VERSION, Instant.now());
            for (String name : List.of("teams", "team_members", "workspaces", "workspace_audits", "workspace_creation_requests",
                    "workspace_activities", "workspace_outbox_events", "workspace_sections", "milestones", "milestone_audit_logs",
                    "milestone_checklist_items", "milestone_risk_alerts", "milestone_idempotency_records", "project_templates", "sprint_backlog", "project_members")) snapshot(name);
            jdbc.execute("CREATE TABLE IF NOT EXISTS legacy_project_pending (entity_type VARCHAR(80), entity_id VARCHAR(100), reason VARCHAR(500) NOT NULL, PRIMARY KEY(entity_type,entity_id))");
            ensureTeamTables();
            importTeams();
            migrateWorkspaceReferences(oldWorkspaceTeam || column("workspaces", "legacy_team_id"));
            migrateMilestones();
            migrateTemplates();
            migrateBacklog();
            relax("sprint", "project_id");
            relax("sprint_task", "project_id");
            validateReferences();
            jdbc.update("UPDATE legacy_project_migrations SET completed=true,completed_at=? WHERE version_key=?", Instant.now(), VERSION);
            migratedDatabase = true;
            log.info("Legacy H2 migration completed: {} team mappings, {} preserved workspace(s), {} pending record(s). Original rows are retained in legacy_v1_* tables.",
                    count("legacy_team_mappings", "1=1"), table("workspaces") ? count("workspaces", "1=1") : 0, count("legacy_project_pending", "1=1"));
        }
    }

    private void backup(String url) throws Exception {
        if (!url.startsWith("jdbc:h2:file:")) return;
        String database = url.substring("jdbc:h2:file:".length()).split(";", 2)[0];
        if (database.startsWith("~/")) database = System.getProperty("user.home") + database.substring(1);
        Path directory = Path.of(database).toAbsolutePath().normalize().getParent().resolve("backups");
        Files.createDirectories(directory);
        Path backup = directory.resolve("before-project-team-" + UUID.randomUUID() + ".zip");
        jdbc.execute("BACKUP TO '" + backup.toString().replace("'", "''") + "'");
        log.info("H2 database backup saved to {}", backup);
    }

    private void snapshot(String name) {
        if (table(name) && !table("legacy_v1_" + name)) jdbc.execute("CREATE TABLE legacy_v1_" + name + " AS SELECT * FROM " + name);
    }

    private void ensureTeamTables() {
        String audit = "created_at TIMESTAMP NOT NULL,created_by BIGINT,is_active BOOLEAN NOT NULL,updated_at TIMESTAMP NOT NULL,updated_by BIGINT,";
        jdbc.execute("CREATE TABLE IF NOT EXISTS training_classes(class_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY," + audit
                + "code VARCHAR(50) NOT NULL,name VARCHAR(255) NOT NULL,tenant_id BIGINT NOT NULL,program_id BIGINT,program_name VARCHAR(255),cohort_id BIGINT,cohort_name VARCHAR(255),mentor_id BIGINT,status VARCHAR(20) NOT NULL,project_template_id BIGINT)");
        jdbc.execute("ALTER TABLE training_classes ADD COLUMN IF NOT EXISTS legacy_imported BOOLEAN DEFAULT false NOT NULL");
        relax("training_classes", "program_id");
        jdbc.execute("ALTER TABLE training_classes ADD CONSTRAINT IF NOT EXISTS ck_legacy_class_program CHECK (program_id IS NOT NULL OR legacy_imported=true)");
        jdbc.execute("CREATE TABLE IF NOT EXISTS team_allocation_sessions(id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY," + audit
                + "class_id BIGINT NOT NULL,project_template_id BIGINT,max_members INTEGER NOT NULL,status VARCHAR(20) NOT NULL,version BIGINT NOT NULL)");
        jdbc.execute("CREATE TABLE IF NOT EXISTS project_teams(id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY," + audit
                + "class_id BIGINT NOT NULL,allocation_session_id BIGINT NOT NULL,project_id BIGINT,team_name VARCHAR(255) NOT NULL,assigned_mentor_id BIGINT,max_members INTEGER NOT NULL,status VARCHAR(20) NOT NULL,version BIGINT NOT NULL,"
                + "mission VARCHAR(2000),definition_of_done VARCHAR(2000),primary_channel VARCHAR(255),core_hours VARCHAR(255),conflict_resolution VARCHAR(2000))");
        jdbc.execute("CREATE TABLE IF NOT EXISTS class_members(member_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY," + audit
                + "class_id BIGINT NOT NULL,user_id BIGINT NOT NULL,status VARCHAR(20) NOT NULL,joined_at TIMESTAMP)");
        jdbc.execute("CREATE TABLE IF NOT EXISTS project_members(id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY," + audit
                + "team_id BIGINT NOT NULL,member_id BIGINT NOT NULL,member_role VARCHAR(30))");
        jdbc.execute("CREATE TABLE IF NOT EXISTS legacy_team_mappings(legacy_team_id BIGINT PRIMARY KEY,project_team_id BIGINT UNIQUE NOT NULL,class_id BIGINT NOT NULL,tenant_id BIGINT NOT NULL)");
        jdbc.execute("CREATE TABLE IF NOT EXISTS legacy_team_member_mappings(legacy_member_id BIGINT PRIMARY KEY,project_member_id BIGINT NOT NULL,class_member_id BIGINT NOT NULL,source_role VARCHAR(32),source_participation_status VARCHAR(32))");
    }

    private void importTeams() {
        if (!table("legacy_v1_teams")) return;
        for (var team : jdbc.queryForList("SELECT * FROM legacy_v1_teams ORDER BY id")) {
            long oldId = number(team.get("ID"));
            if (count("legacy_team_mappings", "legacy_team_id=" + oldId) > 0) continue;
            long tenant = number(team.get("TENANT_ID"));
            Object project = team.get("PROJECT_ID");
            String code = "IMPORTED-TEAM-" + oldId;
            if (project != null && count("projects", "id=" + number(project) + " AND tenant_id=" + tenant) != 1)
                throw new IllegalStateException("Legacy team " + oldId + " has an invalid project/tenant relation; original data was backed up.");
            if (project != null && count("project_teams", "project_id=" + number(project)) > 0) {
                Long resumed = jdbc.queryForObject("SELECT COUNT(*) FROM project_teams p JOIN training_classes c ON c.class_id=p.class_id "
                        + "WHERE p.project_id=? AND c.tenant_id=? AND c.code=? AND c.legacy_imported=true",Long.class,project,tenant,code);
                if (!Long.valueOf(1).equals(resumed))
                    throw new IllegalStateException("Project " + project + " already belongs to a ProjectTeam; supply an explicit legacy team mapping before migration.");
            }
            var cohort = project == null ? List.<Map<String,Object>>of() : jdbc.queryForList(
                    "SELECT c.id,c.name FROM cohorts c JOIN projects p ON p.cohort_id=c.id WHERE p.id=? AND c.tenant_id=?", project, tenant);
            int maximum = Math.max(5, table("legacy_v1_team_members") ? (int) count("legacy_v1_team_members", "team_id=" + oldId) : 0);
            var existingClass = jdbc.queryForList("SELECT class_id FROM training_classes WHERE code=? AND tenant_id=? AND legacy_imported=true", code, tenant);
            long classId = existingClass.isEmpty() ? insert("INSERT INTO training_classes(created_at,created_by,is_active,updated_at,updated_by,code,name,tenant_id,program_id,program_name,cohort_id,cohort_name,mentor_id,status,legacy_imported) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,true)",
                    team.get("CREATED_AT"), team.get("CREATED_BY"), team.get("IS_ACTIVE"), team.get("UPDATED_AT"), team.get("UPDATED_BY"), code,
                    truncate("Imported · " + team.get("NAME"),255), tenant, null, "Not assigned (legacy)", cohort.isEmpty()?null:cohort.getFirst().get("ID"),
                    cohort.isEmpty()?null:cohort.getFirst().get("NAME"), team.get("MENTOR_ID"), Boolean.TRUE.equals(team.get("IS_ACTIVE"))?"ONGOING":"CANCELLED") : number(existingClass.getFirst().get("CLASS_ID"));
            var sessions = jdbc.queryForList("SELECT id FROM team_allocation_sessions WHERE class_id=?",classId);
            long sessionId = sessions.isEmpty() ? insert("INSERT INTO team_allocation_sessions(created_at,created_by,is_active,updated_at,updated_by,class_id,max_members,status,version) VALUES (?,?,?,?,?,?,?,'PUBLISHED',0)",
                    team.get("CREATED_AT"),team.get("CREATED_BY"),team.get("IS_ACTIVE"),team.get("UPDATED_AT"),team.get("UPDATED_BY"),classId,maximum) : number(sessions.getFirst().get("ID"));
            var imported = jdbc.queryForList("SELECT id FROM project_teams WHERE class_id=? AND allocation_session_id=?",classId,sessionId);
            long target = imported.isEmpty() ? insert("INSERT INTO project_teams(created_at,created_by,is_active,updated_at,updated_by,class_id,allocation_session_id,project_id,team_name,assigned_mentor_id,max_members,status,version,mission,definition_of_done,primary_channel,core_hours,conflict_resolution) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?,?)",
                    team.get("CREATED_AT"),team.get("CREATED_BY"),team.get("IS_ACTIVE"),team.get("UPDATED_AT"),team.get("UPDATED_BY"),classId,sessionId,project,
                    team.get("NAME"),team.get("MENTOR_ID"),maximum,Boolean.TRUE.equals(team.get("IS_ACTIVE"))?"ACTIVE":"ARCHIVED",
                    team.get("MISSION"),team.get("DEFINITION_OF_DONE"),team.get("PRIMARY_CHANNEL"),team.get("CORE_HOURS"),team.get("CONFLICT_RESOLUTION")) : number(imported.getFirst().get("ID"));
            jdbc.update("INSERT INTO legacy_team_mappings VALUES (?,?,?,?)",oldId,target,classId,tenant);
        }
        importMembers();
    }

    private void importMembers() {
        if (!table("legacy_v1_team_members")) return;
        for (var member : jdbc.queryForList("SELECT m.*,x.project_team_id,x.class_id,x.tenant_id FROM legacy_v1_team_members m JOIN legacy_team_mappings x ON x.legacy_team_id=m.team_id ORDER BY m.id")) {
            long old = number(member.get("ID"));
            if (count("legacy_team_member_mappings", "legacy_member_id=" + old) > 0) continue;
            long user = number(member.get("USER_ID")), tenant = number(member.get("TENANT_ID"));
            if (count("users", "id=" + user + " AND tenant_id=" + tenant) != 1)
                throw new IllegalStateException("Legacy membership " + old + " has an invalid tenant/user relation; original data was backed up.");
            boolean active = Boolean.TRUE.equals(member.get("IS_ACTIVE")) && "ACTIVE".equals(member.get("PARTICIPATION_STATUS"));
            Object joined = member.get("JOINED_AT") == null ? member.get("CREATED_AT") : member.get("JOINED_AT");
            var existing = jdbc.queryForList("SELECT member_id FROM class_members WHERE class_id=? AND user_id=?",member.get("CLASS_ID"),user);
            long cm = existing.isEmpty() ? insert("INSERT INTO class_members(created_at,created_by,is_active,updated_at,updated_by,class_id,user_id,status,joined_at) VALUES (?,?,?,?,?,?,?,?,?)",
                    joined,member.get("CREATED_BY"),member.get("IS_ACTIVE"),member.get("UPDATED_AT"),member.get("UPDATED_BY"),member.get("CLASS_ID"),user,active?"ACTIVE":"INACTIVE",joined)
                    : number(existing.getFirst().get("MEMBER_ID"));
            String role = Objects.toString(member.get("PROJECT_ROLE"),"UNASSIGNED");
            String canonical = switch(role) {case "TEAM_LEADER"->"PM";case "FE_DEV","BE_DEV"->"DEV";case "TESTER"->"QA";case "UNASSIGNED"->null;default->role;};
            var prior = jdbc.queryForList("SELECT id FROM project_members WHERE team_id=? AND member_id=?",member.get("PROJECT_TEAM_ID"),cm);
            long pm = prior.isEmpty() ? insert("INSERT INTO project_members(created_at,created_by,is_active,updated_at,updated_by,team_id,member_id,member_role) VALUES (?,?,?,?,?,?,?,?)",
                    joined,member.get("CREATED_BY"),active,member.get("UPDATED_AT"),member.get("UPDATED_BY"),member.get("PROJECT_TEAM_ID"),cm,canonical) : number(prior.getFirst().get("ID"));
            jdbc.update("INSERT INTO legacy_team_member_mappings VALUES (?,?,?,?,?)",old,pm,cm,role,member.get("PARTICIPATION_STATUS"));
        }
    }

    private void migrateWorkspaceReferences(boolean legacy) throws Exception {
        if (!legacy || !table("workspaces")) return;
        for (String name : List.of("workspaces","workspace_audits")) {
            if (!table(name)) continue;
            jdbc.execute("ALTER TABLE " + name + " ADD COLUMN IF NOT EXISTS legacy_team_id BIGINT");
            jdbc.execute("UPDATE " + name + " SET legacy_team_id=team_id WHERE legacy_team_id IS NULL");
        }
        try (var connection = Objects.requireNonNull(jdbc.getDataSource()).getConnection();
             var keys = connection.getMetaData().getImportedKeys(null,"PUBLIC","WORKSPACES")) {
            var names = new HashSet<String>();
            while (keys.next()) if ("TEAM_ID".equals(keys.getString("FKCOLUMN_NAME"))) names.add(keys.getString("FK_NAME"));
            for (String name : names) jdbc.execute("ALTER TABLE workspaces DROP CONSTRAINT " + quote(name));
        }
        if (count("workspaces", "NOT EXISTS(SELECT 1 FROM legacy_team_mappings m WHERE m.legacy_team_id=workspaces.legacy_team_id AND m.tenant_id=workspaces.tenant_id)") > 0)
            throw new IllegalStateException("A legacy workspace has no same-tenant team mapping. No workspace was removed.");
        for (String name : List.of("workspaces","workspace_audits")) if (table(name))
            jdbc.execute("UPDATE " + name + " w SET team_id=(SELECT m.project_team_id FROM legacy_team_mappings m WHERE m.legacy_team_id=w.legacy_team_id AND m.tenant_id=w.tenant_id) WHERE EXISTS(SELECT 1 FROM legacy_team_mappings m WHERE m.legacy_team_id=w.legacy_team_id AND m.tenant_id=w.tenant_id)");
        jdbc.execute("ALTER TABLE workspaces ADD CONSTRAINT fk_workspaces_project_team FOREIGN KEY(team_id) REFERENCES project_teams(id)");
        if (table("legacy_v1_workspace_creation_requests")) {
            var mapper = new ObjectMapper();
            for (var row : jdbc.queryForList("SELECT r.id,r.response_json,m.project_team_id FROM legacy_v1_workspace_creation_requests r JOIN legacy_v1_workspaces w ON w.id=r.workspace_id JOIN legacy_team_mappings m ON m.legacy_team_id=w.team_id")) {
                ObjectNode response = (ObjectNode) mapper.readTree(Objects.toString(row.get("RESPONSE_JSON")));
                if (response.has("teamId")) response.put("teamId",number(row.get("PROJECT_TEAM_ID")));
                jdbc.update("UPDATE workspace_creation_requests SET response_json=? WHERE id=?",mapper.writeValueAsString(response),row.get("ID"));
            }
        }
    }

    private void migrateMilestones() {
        if (!table("milestones") || (!uuidColumn("milestones","project_id") && !column("milestones","legacy_project_uuid"))) return;
        convertUuidColumn("milestones","project_id","legacy_project_uuid");
        convertUuidColumn("milestones","tenant_id","legacy_tenant_uuid");
        jdbc.execute("ALTER TABLE milestones ADD COLUMN IF NOT EXISTS team_id BIGINT");
        String tenantField = column("milestones","legacy_tenant_uuid") ? "legacy_tenant_uuid" : "tenant_id AS legacy_numeric_tenant";
        for (var row : jdbc.queryForList("SELECT milestone_id,legacy_project_uuid," + tenantField + " FROM milestones WHERE legacy_project_uuid IS NOT NULL")) {
            UUID legacyProject = (UUID) row.get("LEGACY_PROJECT_UUID"), legacyTenant = (UUID) row.get("LEGACY_TENANT_UUID");
            var links = table("task_alert_project_links") ? jdbc.queryForList("SELECT p.id,p.tenant_id,t.id AS team_id FROM task_alert_project_links a JOIN projects p ON p.id=a.project_id AND p.tenant_id=a.tenant_id JOIN project_teams t ON t.project_id=p.id JOIN training_classes c ON c.class_id=t.class_id AND c.tenant_id=p.tenant_id WHERE a.id=?",legacyProject) : List.<Map<String,Object>>of();
            boolean tenantMatches = links.size()==1 && (legacyTenant != null
                    ? tenantAlias(number(links.getFirst().get("TENANT_ID"))).equals(legacyTenant)
                    : Objects.equals(row.get("LEGACY_NUMERIC_TENANT"),links.getFirst().get("TENANT_ID")));
            if (!tenantMatches) {
                pending("MILESTONE",row.get("MILESTONE_ID"),"No authoritative same-tenant project/team mapping for the legacy UUID; full row and checklist retained in legacy_v1_* tables.");
                continue;
            }
            var link = links.getFirst();
            jdbc.update("UPDATE milestones SET project_id=?,tenant_id=?,team_id=? WHERE milestone_id=?",link.get("ID"),link.get("TENANT_ID"),link.get("TEAM_ID"),row.get("MILESTONE_ID"));
        }
        if (table("milestone_checklist_items")) jdbc.execute("DELETE FROM milestone_checklist_items WHERE milestone_id IN (SELECT milestone_id FROM milestones WHERE tenant_id IS NULL OR team_id IS NULL)");
        jdbc.execute("DELETE FROM milestones WHERE tenant_id IS NULL OR team_id IS NULL");
        jdbc.execute("ALTER TABLE milestones ALTER COLUMN tenant_id SET NOT NULL");
        jdbc.execute("ALTER TABLE milestones ALTER COLUMN team_id SET NOT NULL");
        for (String name : List.of("milestone_audit_logs","milestone_risk_alerts")) {
            if (!table(name)) continue;
            convertUuidColumn(name,"project_id","legacy_project_uuid");
            convertUuidColumn(name,"tenant_id","legacy_tenant_uuid");
            if (!column(name,"legacy_project_uuid")) continue;
            String tenantMatch = column(name,"legacy_tenant_uuid") ? "m.legacy_tenant_uuid=a.legacy_tenant_uuid" : "m.tenant_id=a.tenant_id";
            jdbc.execute("UPDATE " + name + " a SET project_id=(SELECT m.project_id FROM milestones m WHERE m.milestone_id=a.milestone_id),tenant_id=(SELECT m.tenant_id FROM milestones m WHERE m.milestone_id=a.milestone_id) WHERE EXISTS(SELECT 1 FROM milestones m WHERE m.milestone_id=a.milestone_id AND m.legacy_project_uuid=a.legacy_project_uuid AND " + tenantMatch + ")");
            String id = name.equals("milestone_audit_logs") ? "audit_id" : "id";
            for (var row : jdbc.queryForList("SELECT " + id + " FROM " + name + " WHERE tenant_id IS NULL OR project_id IS NULL")) pending(name,row.get(id.toUpperCase(Locale.ROOT)),"Legacy history retained in legacy_v1_" + name + "; milestone could not be mapped.");
            jdbc.execute("DELETE FROM " + name + " WHERE tenant_id IS NULL OR project_id IS NULL");
            jdbc.execute("ALTER TABLE " + name + " ALTER COLUMN tenant_id SET NOT NULL");
        }
        relax("milestones","project_id");
        relax("milestone_audit_logs","project_id");
    }

    private void convertUuidColumn(String name,String field,String legacy) {
        if (uuidColumn(name,field)) {
            jdbc.execute("ALTER TABLE " + name + " RENAME COLUMN " + field + " TO " + legacy);
            relax(name,legacy);
        }
        if (!column(name,field)) jdbc.execute("ALTER TABLE " + name + " ADD COLUMN " + field + " BIGINT");
    }

    private void migrateTemplates() {
        if (!table("project_templates") || !column("project_templates","title")) return;
        jdbc.execute("ALTER TABLE project_templates ADD COLUMN IF NOT EXISTS code VARCHAR(100)");
        jdbc.execute("ALTER TABLE project_templates ADD COLUMN IF NOT EXISTS name VARCHAR(255)");
        jdbc.execute("ALTER TABLE project_templates ADD COLUMN IF NOT EXISTS constraints_json TEXT");
        jdbc.execute("UPDATE project_templates SET code='IMPORTED-TEMPLATE-' || id WHERE code IS NULL");
        jdbc.execute("UPDATE project_templates SET name=title WHERE name IS NULL");
        jdbc.execute("UPDATE project_templates SET constraints_json='{}' WHERE constraints_json IS NULL");
        for (String field : List.of("code","name","constraints_json")) jdbc.execute("ALTER TABLE project_templates ALTER COLUMN " + field + " SET NOT NULL");
        // These unmapped columns remain available in old snapshots but must not block new-template inserts.
        for (String field : List.of("title","content_json","tenant_id","review_status","status")) relax("project_templates",field);
    }

    private void migrateBacklog() {
        if (!table("sprint_backlog")) return;
        jdbc.execute("ALTER TABLE sprint_backlog ADD COLUMN IF NOT EXISTS work_type VARCHAR(20) DEFAULT 'TASK' NOT NULL");
        // Old sample assignee numbers were not backed by ProjectMember records. They
        // must not accidentally resolve to newly generated membership IDs after import.
        if (table("legacy_v1_project_members")) {
            jdbc.execute("ALTER TABLE sprint_backlog ADD COLUMN IF NOT EXISTS legacy_assignee_project_member_id BIGINT");
            jdbc.execute("UPDATE sprint_backlog b SET legacy_assignee_project_member_id=assignee_project_member_id,assignee_project_member_id=NULL "
                    + "WHERE assignee_project_member_id IS NOT NULL AND legacy_assignee_project_member_id IS NULL "
                    + "AND NOT EXISTS(SELECT 1 FROM legacy_v1_project_members m WHERE m.id=b.assignee_project_member_id)");
        }
    }

    private void validateReferences() {
        if (table("workspaces") && count("workspaces", "NOT EXISTS(SELECT 1 FROM project_teams p JOIN training_classes c ON c.class_id=p.class_id WHERE p.id=workspaces.team_id AND c.tenant_id=workspaces.tenant_id AND (workspaces.project_id IS NULL OR p.project_id=workspaces.project_id))") > 0)
            throw new IllegalStateException("Migration verification failed: a workspace does not match its project/team/tenant.");
        if (table("milestones") && count("milestones", "NOT EXISTS(SELECT 1 FROM project_teams p JOIN training_classes c ON c.class_id=p.class_id WHERE p.id=milestones.team_id AND c.tenant_id=milestones.tenant_id AND (milestones.project_id IS NULL OR p.project_id=milestones.project_id))") > 0)
            throw new IllegalStateException("Migration verification failed: a milestone does not match its project/team/tenant.");
        for (String name : List.of("workspaces","workspace_audits","workspace_creation_requests","workspace_activities","workspace_sections","workspace_outbox_events","team_members","teams"))
            if (table("legacy_v1_" + name) && count(name,"1=1") != count("legacy_v1_" + name,"1=1"))
                throw new IllegalStateException("Migration verification failed: row count changed for " + name);
    }

    private void pending(String type,Object id,String reason) {
        jdbc.update("MERGE INTO legacy_project_pending(entity_type,entity_id,reason) KEY(entity_type,entity_id) VALUES (?,?,?)",type,id.toString(),reason);
    }
    private String importedTeamTable() throws SQLException {
        if (!table("workspaces")) return "";
        try (var connection=Objects.requireNonNull(jdbc.getDataSource()).getConnection();var keys=connection.getMetaData().getImportedKeys(null,"PUBLIC","WORKSPACES")) {
            while(keys.next()) if ("TEAM_ID".equals(keys.getString("FKCOLUMN_NAME")) && "TEAMS".equals(keys.getString("PKTABLE_NAME"))) return "TEAMS";
        }
        return "";
    }
    private boolean table(String name) {return Boolean.TRUE.equals(jdbc.queryForObject("SELECT COUNT(*)>0 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='PUBLIC' AND TABLE_NAME=?",Boolean.class,name.toUpperCase(Locale.ROOT)));}
    private boolean column(String name,String field) {return Boolean.TRUE.equals(jdbc.queryForObject("SELECT COUNT(*)>0 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='PUBLIC' AND TABLE_NAME=? AND COLUMN_NAME=?",Boolean.class,name.toUpperCase(Locale.ROOT),field.toUpperCase(Locale.ROOT)));}
    private boolean uuidColumn(String name,String field) {return Boolean.TRUE.equals(jdbc.queryForObject("SELECT COUNT(*)>0 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='PUBLIC' AND TABLE_NAME=? AND COLUMN_NAME=? AND DATA_TYPE='UUID'",Boolean.class,name.toUpperCase(Locale.ROOT),field.toUpperCase(Locale.ROOT)));}
    private void relax(String name,String field) {if(column(name,field)) jdbc.execute("ALTER TABLE " + name + " ALTER COLUMN " + field + " DROP NOT NULL");}
    private long count(String name,String where) {return Objects.requireNonNull(jdbc.queryForObject("SELECT COUNT(*) FROM " + name + " WHERE " + where,Long.class));}
    private long number(Object value) {return ((Number)value).longValue();}
    private UUID tenantAlias(long tenant) {return UUID.nameUUIDFromBytes(("fams:milestone:tenant:" + tenant).getBytes(StandardCharsets.UTF_8));}
    private String quote(String name) {return "\"" + name.replace("\"","\"\"") + "\"";}
    private String truncate(String value,int length) {return value.length()>length?value.substring(0,length):value;}
    private long insert(String sql,Object... values) {
        var keys=new GeneratedKeyHolder();
        jdbc.update(connection->{var statement=connection.prepareStatement(sql,Statement.RETURN_GENERATED_KEYS);for(int i=0;i<values.length;i++)statement.setObject(i+1,values[i]);return statement;},keys);
        return Objects.requireNonNull(keys.getKey()).longValue();
    }
}
