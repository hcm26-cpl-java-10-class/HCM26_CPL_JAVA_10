import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.sql.*;
import java.time.*;
import java.util.*;

/** Explicit one-time local maintenance. Does not change application assignment rules. */
public class SwitchDemoTemplate145 {
    static final ObjectMapper JSON = new ObjectMapper();
    static final String PROJECTS = "148,149,150";
    static final String TEAMS = "125,126,156";

    public static void main(String[] args) throws Exception {
        if (args.length != 3) throw new IllegalArgumentException("prepare|apply|verify DATABASE BACKUP_DIRECTORY");
        Path db = Path.of(args[1]).toAbsolutePath().normalize();
        Path output = Path.of(args[2]).toAbsolutePath().normalize();
        require(db.getFileName().toString().equals("fams_lms_after_merge.mv.db"), "Reviewed local database required");
        require(output.startsWith(db.getParent().resolve("backups")) && output.getFileName().toString().startsWith("template-144-to-145-"), "Dedicated backup required");
        switch (args[0]) {
            case "prepare" -> {
                require(!Files.exists(output), "Backup directory already exists");
                String hash = AddDashboardReviewClasses.fileHash(db);
                try (var c = AddDashboardReviewClasses.open(db, true)) { validate(c); }
                require(hash.equals(AddDashboardReviewClasses.fileHash(db)), "Database changed during preflight");
                Files.createDirectories(output);
                Files.copy(db, output.resolve("before.mv.db"));
                Files.copy(db, output.resolve("rehearsal.mv.db"));
                var result = change(output.resolve("rehearsal.mv.db"));
                require(hash.equals(AddDashboardReviewClasses.fileHash(db)), "Database changed during rehearsal");
                require(hash.equals(AddDashboardReviewClasses.fileHash(output.resolve("before.mv.db"))), "Backup hash mismatch");
                Properties manifest = new Properties();
                manifest.setProperty("source", db.toString()); manifest.setProperty("sha256", hash);
                try (var out = Files.newOutputStream(output.resolve("prepared.properties"))) { manifest.store(out, "Local demo template switch, 144 -> 145"); }
                JSON.writerWithDefaultPrettyPrinter().writeValue(output.resolve("rehearsal.json").toFile(), result);
                System.out.println("PASS: rehearsal and protected-row comparison. Backup: " + output);
            }
            case "apply" -> {
                Properties manifest = new Properties();
                try (var in = Files.newInputStream(output.resolve("prepared.properties"))) { manifest.load(in); }
                String hash = manifest.getProperty("sha256");
                require(db.toString().equals(manifest.getProperty("source")), "Wrong database");
                require(hash.equals(AddDashboardReviewClasses.fileHash(db)), "Database changed after rehearsal");
                require(hash.equals(AddDashboardReviewClasses.fileHash(output.resolve("before.mv.db"))), "Backup changed");
                var result = change(db);
                require(hash.equals(AddDashboardReviewClasses.fileHash(output.resolve("before.mv.db"))), "Backup changed during apply");
                JSON.writerWithDefaultPrettyPrinter().writeValue(output.resolve("applied.json").toFile(), result);
                JSON.writerWithDefaultPrettyPrinter().writeValue(System.out, result);
            }
            case "verify" -> {
                try (var c = AddDashboardReviewClasses.open(db, true)) {
                    verify(c);
                    JSON.writerWithDefaultPrettyPrinter().writeValue(System.out, summary(c));
                }
            }
            default -> throw new IllegalArgumentException("Unknown mode");
        }
    }

    static void validate(Connection c) throws Exception {
        require(count(c, "SELECT COUNT(*) FROM PROJECT_TEMPLATES WHERE ID IN(144,145) AND TENANT_ID=1 AND STATUS='ACTIVE' AND IS_ACTIVE=TRUE") == 2, "Expected both active local templates");
        require(count(c, "SELECT COUNT(*) FROM PROJECT_TEMPLATE_VERSION WHERE SNAPSHOT_ID=232 AND TEMPLATE_ID=145 AND PROJECT_ID IS NULL AND STATUS='PUBLISHED' AND IS_ACTIVE=TRUE") == 1, "Template 145 source version changed");
        require(count(c, "SELECT COUNT(*) FROM PROJECT_TEAMS T JOIN TRAINING_CLASSES C ON C.CLASS_ID=T.CLASS_ID WHERE T.ID IN("+TEAMS+") AND C.TENANT_ID=1 AND C.CODE IN('DASH-C','DASH-D') AND T.PROJECT_TEMPLATE_ID=144 AND T.PROJECT_ID IN("+PROJECTS+") AND T.STATUS='DRAFT'") == 3, "Team scope changed");
        require(count(c, "SELECT COUNT(*) FROM PROJECT_TEAMS WHERE PROJECT_TEMPLATE_ID=144") == 3, "Another team uses template 144");
        require(count(c, "SELECT COUNT(*) FROM PROJECTS WHERE ID IN("+PROJECTS+") AND TENANT_ID=1 AND STATUS='PLANNING'") == 3, "A project has started");
        for (String table : List.of("MILESTONE_ARTIFACT_SUBMISSIONS", "MILESTONE_SUBMISSIONS", "SPRINT", "PROJECT_RESOURCES"))
            require(count(c, "SELECT COUNT(*) FROM "+table+" WHERE PROJECT_ID IN("+PROJECTS+")") == 0, "Existing work in " + table);
        require(count(c, "SELECT COUNT(*) FROM MILESTONE_ARTIFACT_DRAFTS WHERE MILESTONE_ID IN(SELECT MILESTONE_ID FROM MILESTONES WHERE PROJECT_ID IN("+PROJECTS+"))") == 0, "An artifact draft exists");
        require(count(c, "SELECT COUNT(*) FROM PROJECT_TEMPLATE_RESOURCES WHERE TEMPLATE_VERSION_ID=232") == 0, "Target resources require separate copying");
        require(count(c, "SELECT COUNT(*) FROM MILESTONES WHERE PROJECT_ID IN("+PROJECTS+")") == 9, "Unexpected milestone count");
        require(count(c, "SELECT COUNT(*) FROM MILESTONES WHERE PROJECT_ID IN("+PROJECTS+") AND LIFECYCLE_STATUS='PLANNED' AND STATUS='PLANNED' AND AUTO_START_ENABLED=FALSE AND IS_ACTIVE=TRUE") == 9, "Milestone work or schedule changed");
        require(count(c, "SELECT COUNT(*) FROM MILESTONE_CHECKLIST_ITEMS WHERE MILESTONE_ID IN(SELECT MILESTONE_ID FROM MILESTONES WHERE PROJECT_ID IN("+PROJECTS+")) AND IS_COMPLETED=TRUE") == 0, "A checklist has progress");
        require(count(c, "SELECT COUNT(*) FROM SPRINT_BACKLOG WHERE PROJECT_ID IN("+PROJECTS+")") == 36, "Unexpected backlog count");
        require(count(c, "SELECT COUNT(*) FROM SPRINT_BACKLOG WHERE PROJECT_ID IN("+PROJECTS+") AND STATUS='TODO' AND SPRINT_ID IS NULL AND MILESTONE_ID IS NULL AND ASSIGNEE_PROJECT_MEMBER_ID IS NULL AND IS_ACTIVE=TRUE") == 36, "A backlog item has been planned or changed");
        require(count(c, "SELECT COUNT(*) FROM PROJECT_TEMPLATE_MILESTONES WHERE TEMPLATE_ID=145") == 3, "Target plan changed");
        require(count(c, "SELECT COUNT(*) FROM PROJECT_TEMPLATE_BACKLOG_ITEMS WHERE TEMPLATE_ID=145") == 12, "Target backlog changed");
        for (var team : rows(c, "SELECT ID FROM PROJECT_TEAMS WHERE ID IN("+TEAMS+")"))
            require(count(c, "SELECT COUNT(*) FROM PROJECT_MEMBERS WHERE TEAM_ID="+team.get("ID")) == 4, "Team membership changed");
    }

    static Map<String,Object> change(Path db) throws Exception {
        try (var c = AddDashboardReviewClasses.open(db, false)) {
            c.setAutoCommit(false);
            try {
                validate(c);
                String correlation = "local-template-switch-" + UUID.randomUUID();
                var protectedBefore = protectedRows(c, correlation);
                long actor = count(c, "SELECT ID FROM USERS WHERE EMAIL='admin@example.com' AND TENANT_ID=1");
                Timestamp localNow = Timestamp.valueOf(LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")));
                Instant now = Instant.now();
                var template = rows(c, "SELECT * FROM PROJECT_TEMPLATES WHERE ID=145").getFirst();
                var plan = rows(c, "SELECT * FROM PROJECT_TEMPLATE_MILESTONES WHERE TEMPLATE_ID=145 ORDER BY ORDER_INDEX,ID");
                var oldPlan = rows(c, "SELECT * FROM PROJECT_TEMPLATE_MILESTONES WHERE TEMPLATE_ID=144 ORDER BY ORDER_INDEX,ID");
                var backlog = rows(c, "SELECT * FROM PROJECT_TEMPLATE_BACKLOG_ITEMS WHERE TEMPLATE_ID=145 ORDER BY ORDER_INDEX,ID");
                for (var team : rows(c, "SELECT * FROM PROJECT_TEAMS WHERE ID IN("+TEAMS+") ORDER BY ID")) {
                    long teamId = number(team.get("ID")); long projectId = number(team.get("PROJECT_ID"));
                    var before = new LinkedHashMap<>(Map.of("teamId",teamId,"projectId",projectId,"templateId",144,"sourceVersionId",225));
                    ObjectNode content = JSON.createObjectNode();
                    content.put("purpose","TEAM_ASSIGNMENT"); content.put("assignedTeamId",teamId); content.put("templateId",145);
                    for (String field : List.of("CODE","NAME","CATEGORY","ESTIMATED_DURATION_WEEKS")) content.set(snakeToCamel(field), JSON.valueToTree(template.get(field)));
                    content.set("context",JSON.valueToTree(template.get("DESCRIPTION")));
                    content.set("level",JSON.valueToTree(template.get("DIFFICULTY_LEVEL")));
                    content.put("sourceSnapshotId",232); content.put("sourceVersion","v1.0");
                    content.set("constraints",JSON.readTree(template.get("CONSTRAINTS_JSON").toString()));
                    content.set("milestones",JSON.valueToTree(plan.stream().map(stage -> snapshotStage(c,stage)).toList()));
                    content.set("backlogItems",JSON.valueToTree(backlog.stream().map(item -> Map.of(
                            "title",item.get("TITLE"),"description",Objects.toString(item.get("DESCRIPTION"),""),
                            "suggestedRole",Objects.toString(item.get("SUGGESTED_ROLE"),""),"orderIndex",item.get("ORDER_INDEX"))).toList()));
                    long snapshot = generated(c, "INSERT INTO PROJECT_TEMPLATE_VERSION(CREATED_AT,CREATED_BY,IS_ACTIVE,UPDATED_AT,UPDATED_BY,CONTENT_JSON,PARENT_TEMPLATE_ID,PROJECT_ID,STATUS,TEMPLATE_ID,VERSION) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                            localNow,actor,false,localNow,actor,content.toString(),232L,projectId,"PUBLISHED",145L,"v1.0-T"+teamId+"-local-switch");
                    update(c, "UPDATE PROJECT_TEAMS SET PROJECT_TEMPLATE_ID=145,PROJECT_TEMPLATE_VERSION_ID=232,MAX_MEMBERS=4,VERSION=VERSION+1,UPDATED_AT=?,UPDATED_BY=? WHERE ID=?",localNow,actor,teamId);
                    update(c, "UPDATE PROJECTS SET TEMPLATE_SNAPSHOT_ID=?,NAME=?,DESCRIPTION=?,UPDATED_AT=?,UPDATED_BY=? WHERE ID=?",snapshot,template.get("NAME"),template.get("DESCRIPTION"),localNow,actor,projectId);
                    var currentStages = rows(c,"SELECT * FROM MILESTONES WHERE PROJECT_ID="+projectId+" ORDER BY DEADLINE,MILESTONE_ID");
                    for (int i=0; i<plan.size(); i++) {
                        var stage = plan.get(i); var current = currentStages.get(i); var old = oldPlan.get(i);
                        require(current.get("TITLE").equals(old.get("TITLE")), "Unexpected edited milestone");
                        Instant base = ((OffsetDateTime)current.get("DEADLINE")).toInstant().minus(Duration.ofDays(days(old)));
                        Instant deadline = base.plus(Duration.ofDays(days(stage)));
                        boolean allowLate = Boolean.TRUE.equals(stage.get("ALLOW_LATE_SUBMISSION"));
                        update(c, "UPDATE MILESTONES SET TITLE=?,DESCRIPTION=?,DEADLINE=?,IS_MANDATORY=?,RUBRIC_SNAPSHOT_ID=?,WEIGHT=?,LATE_POLICY_TYPE=?,LATE_UNTIL=?,LATE_PENALTY_PERCENT=?,LATE_PENALTY_BASIS=?,VERSION=VERSION+1,UPDATED_AT=? WHERE MILESTONE_ID=?",
                                stage.get("TITLE"),stage.get("DESCRIPTION"),OffsetDateTime.ofInstant(deadline,ZoneOffset.UTC),stage.get("IS_MANDATORY"),stage.get("RUBRIC_VERSION_ID"),stage.get("WEIGHT"),
                                allowLate?"ALLOW_LATE":"NO_LATE",allowLate?OffsetDateTime.ofInstant(deadline.plus(Duration.ofDays(number(stage.get("MAX_LATE_DAYS")))),ZoneOffset.UTC):null,
                                allowLate?stage.get("PENALTY_PER_DAY_PERCENT"):null,allowLate?"PER_DAY":"FIXED",OffsetDateTime.ofInstant(now,ZoneOffset.UTC),current.get("MILESTONE_ID"));
                        var checks = rows(c,"SELECT * FROM PROJECT_TEMPLATE_MILESTONE_CHECKLIST WHERE MILESTONE_ID="+stage.get("ID")+" ORDER BY ORDER_INDEX,ID");
                        var currentChecks = rows(c,"SELECT * FROM MILESTONE_CHECKLIST_ITEMS WHERE MILESTONE_ID='"+current.get("MILESTONE_ID")+"' ORDER BY ORDER_INDEX,ITEM_ID");
                        require(checks.size()==currentChecks.size(), "Checklist shape changed; separate migration required");
                        for(int j=0;j<checks.size();j++) update(c,"UPDATE MILESTONE_CHECKLIST_ITEMS SET CONTENT=?,IS_MANDATORY=?,ORDER_INDEX=? WHERE ITEM_ID=?",
                                checks.get(j).get("CONTENT"),checks.get(j).get("IS_MANDATORY"),checks.get(j).get("ORDER_INDEX"),currentChecks.get(j).get("ITEM_ID"));
                    }
                    var currentItems = rows(c,"SELECT * FROM SPRINT_BACKLOG WHERE PROJECT_ID="+projectId+" ORDER BY SPRINT_BACKLOG_ID");
                    for(int i=0;i<backlog.size();i++) update(c,"UPDATE SPRINT_BACKLOG SET TITLE=?,DESCRIPTION=?,VERSION=VERSION+1,UPDATED_AT=?,UPDATED_BY=? WHERE SPRINT_BACKLOG_ID=?",
                            backlog.get(i).get("TITLE"),backlog.get(i).get("DESCRIPTION"),localNow,actor,currentItems.get(i).get("SPRINT_BACKLOG_ID"));
                    var after = new LinkedHashMap<>(Map.of("teamId",teamId,"projectId",projectId,"templateId",145,"sourceVersionId",232,"assignmentSnapshotId",snapshot));
                    generated(c,"INSERT INTO PROJECT_TEAM_AUDIT_LOGS(CREATED_AT,CREATED_BY,IS_ACTIVE,UPDATED_AT,UPDATED_BY,ACTION,ACTOR_ID,CLASS_ID,ALLOCATION_SESSION_ID,BEFORE_STATE,AFTER_STATE,CORRELATION_ID) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                            localNow,actor,true,localNow,actor,"LOCAL_DEMO_TEMPLATE_SWITCH",actor,team.get("CLASS_ID"),team.get("ALLOCATION_SESSION_ID"),JSON.writeValueAsString(before),JSON.writeValueAsString(after),correlation);
                }
                update(c,"UPDATE PROJECT_TEMPLATES SET STATUS='ARCHIVED',LOCK_VERSION=LOCK_VERSION+1,UPDATED_AT=?,UPDATED_BY=? WHERE ID=144",localNow,actor);
                update(c,"UPDATE PROJECT_TEMPLATE_VERSION SET STATUS='ARCHIVED',UPDATED_AT=?,UPDATED_BY=? WHERE SNAPSHOT_ID=225",localNow,actor);
                verify(c);
                require(protectedBefore.equals(protectedRows(c,correlation)), "Rows outside the approved demo switch changed");
                var result = summary(c);
                result.put("protectedTables",protectedBefore.size()); result.put("protectedRowsUnchanged",true);
                result.put("correlationId",correlation); result.put("completedOrSubmitted",false);
                c.commit(); return result;
            } catch (Exception failure) { c.rollback(); throw failure; }
        }
    }

    static Object snapshotStage(Connection c, Map<String,Object> stage) {
        try {
            Map<String,Object> result = new LinkedHashMap<>();
            for (String key : List.of("ID","TITLE","DESCRIPTION","DUE_AFTER","DUE_UNIT","WEIGHT")) result.put(snakeToCamel(key),stage.get(key));
            result.put("mandatory",stage.get("IS_MANDATORY")); result.put("rubricVersionId",stage.get("RUBRIC_VERSION_ID"));
            result.put("latePolicy",Map.of("allowLateSubmission",stage.get("ALLOW_LATE_SUBMISSION"),"maxLateDays",stage.get("MAX_LATE_DAYS"),"penaltyPerDayPercent",stage.get("PENALTY_PER_DAY_PERCENT")));
            result.put("checklist",rows(c,"SELECT CONTENT,IS_MANDATORY,ORDER_INDEX FROM PROJECT_TEMPLATE_MILESTONE_CHECKLIST WHERE MILESTONE_ID="+stage.get("ID")+" ORDER BY ORDER_INDEX,ID").stream().map(row -> Map.of("content",row.get("CONTENT"),"mandatory",row.get("IS_MANDATORY"),"orderIndex",row.get("ORDER_INDEX"))).toList());
            result.put("rubricCriteria",List.of()); return result;
        } catch(Exception failure) { throw new IllegalStateException(failure); }
    }

    static void verify(Connection c) throws Exception {
        require(count(c,"SELECT COUNT(*) FROM PROJECT_TEAMS T JOIN PROJECTS P ON P.ID=T.PROJECT_ID JOIN PROJECT_TEMPLATE_VERSION V ON V.SNAPSHOT_ID=P.TEMPLATE_SNAPSHOT_ID JOIN WORKSPACES W ON W.TEAM_ID=T.ID AND W.PROJECT_ID=P.ID WHERE T.ID IN("+TEAMS+") AND T.PROJECT_TEMPLATE_ID=145 AND T.PROJECT_TEMPLATE_VERSION_ID=232 AND V.TEMPLATE_ID=145 AND V.PARENT_TEMPLATE_ID=232 AND V.PROJECT_ID=P.ID AND V.IS_ACTIVE=FALSE AND T.STATUS='DRAFT' AND P.STATUS='PLANNING' AND W.ID IN(212,213,214)") == 3,"Assignment links do not match");
        require(count(c,"SELECT COUNT(*) FROM PROJECT_TEAMS WHERE PROJECT_TEMPLATE_ID=144") == 0,"Old assignments remain");
        require(count(c,"SELECT COUNT(*) FROM PROJECT_TEMPLATES WHERE ID=144 AND STATUS='ARCHIVED'") == 1,"Old template not archived");
        require(count(c,"SELECT COUNT(*) FROM MILESTONES WHERE PROJECT_ID IN("+PROJECTS+") AND LIFECYCLE_STATUS='PLANNED' AND RUBRIC_SNAPSHOT_ID='22222222-2222-2222-2222-222222222224'") == 9,"Milestone configuration mismatch");
        require(count(c,"SELECT COUNT(*) FROM SPRINT_BACKLOG WHERE PROJECT_ID IN("+PROJECTS+") AND STATUS='TODO' AND IS_ACTIVE=TRUE") == 36,"Backlog status changed");
    }

    static Map<String,Object> summary(Connection c) throws Exception {
        return new LinkedHashMap<>(Map.of("teams",rows(c,"SELECT T.ID,T.TEAM_NAME,T.PROJECT_ID,T.PROJECT_TEMPLATE_ID,T.PROJECT_TEMPLATE_VERSION_ID,P.TEMPLATE_SNAPSHOT_ID,W.ID WORKSPACE_ID FROM PROJECT_TEAMS T JOIN PROJECTS P ON P.ID=T.PROJECT_ID JOIN WORKSPACES W ON W.TEAM_ID=T.ID WHERE T.ID IN("+TEAMS+") ORDER BY T.ID"),"oldTemplateStatus","ARCHIVED","targetTemplate",145,"milestones",9,"backlogItems",36));
    }

    static Map<String,Map<String,Integer>> protectedRows(Connection c, String correlation) throws Exception {
        var filters = Map.of("PROJECT_TEAMS","ID NOT IN("+TEAMS+")","PROJECTS","ID NOT IN("+PROJECTS+")",
                "MILESTONES","PROJECT_ID IS NULL OR PROJECT_ID NOT IN("+PROJECTS+")",
                "MILESTONE_CHECKLIST_ITEMS","MILESTONE_ID NOT IN(SELECT MILESTONE_ID FROM MILESTONES WHERE PROJECT_ID IN("+PROJECTS+"))",
                "SPRINT_BACKLOG","PROJECT_ID IS NULL OR PROJECT_ID NOT IN("+PROJECTS+")","PROJECT_TEMPLATES","ID<>144",
                "PROJECT_TEMPLATE_VERSION","SNAPSHOT_ID<>225 AND NOT(TEMPLATE_ID=145 AND PROJECT_ID IN("+PROJECTS+")) OR PROJECT_ID IS NULL AND SNAPSHOT_ID<>225",
                "PROJECT_TEAM_AUDIT_LOGS","CORRELATION_ID<>'"+correlation+"'");
        var result = new TreeMap<String,Map<String,Integer>>();
        for(var table : rows(c,"SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='PUBLIC' AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME")) {
            String name=table.get("TABLE_NAME").toString(); var hashes=new HashMap<String,Integer>();
            try(var s=c.createStatement();var r=s.executeQuery("SELECT * FROM PUBLIC.\""+name+"\""+(filters.containsKey(name)?" WHERE "+filters.get(name):""))) {
                while(r.next()) {
                    StringBuilder row=new StringBuilder();
                    for(int i=1;i<=r.getMetaData().getColumnCount();i++) {String v=r.getString(i);row.append(v==null?"N;":"V"+v.length()+":"+v+";");}
                    String hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(row.toString().getBytes(StandardCharsets.UTF_8))); hashes.merge(hash,1,Integer::sum);
                }
            }
            result.put(name,hashes);
        }
        return result;
    }
    static String snakeToCamel(String value) { var parts=value.toLowerCase(Locale.ROOT).split("_");var result=new StringBuilder(parts[0]);for(int i=1;i<parts.length;i++) result.append(Character.toUpperCase(parts[i].charAt(0))).append(parts[i].substring(1));return result.toString(); }
    static long days(Map<String,Object> stage) { return number(stage.get("DUE_AFTER"))*("WEEKS".equals(stage.get("DUE_UNIT"))?7:1); }
    static long number(Object value) { return ((Number)value).longValue(); }
    static void require(boolean valid,String message) { if(!valid) throw new IllegalStateException(message); }
    static List<Map<String,Object>> rows(Connection c,String sql) throws SQLException { return AddDashboardReviewClasses.rows(c,sql); }
    static long count(Connection c,String sql) throws SQLException { return AddDashboardReviewClasses.scalar(c,sql); }
    static long generated(Connection c,String sql,Object... args) throws SQLException { return AddDashboardReviewClasses.generated(c,sql,args); }
    static void update(Connection c,String sql,Object... args) throws SQLException { AddDashboardReviewClasses.execute(c,sql,args); }
}
