package com.example.starter_project_2025.system.project.workspace.config;

import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.annotation.Transactional;
import java.nio.file.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

/** Repairs references in the existing class fixtures without generating or replacing any roster. */
@Component @Order(4) @RequiredArgsConstructor @Slf4j
public class ExistingClassRosterContextRepair implements CommandLineRunner {
    private final JdbcTemplate jdbc;
    private final TenantRepository tenants;
    private final UserRepository users;
    @Value("${app.seed.admin.email:admin@example.com}") private String adminEmail;
    private record Change(String type,long id,Long previous,long tenant) { }
    @Override @Transactional
    public void run(String... args) {
        var admin=users.findByEmail(adminEmail).orElseThrow();
        if(admin.getTenantId()==null)return;
        repair(List.of("DEMO-JAVA-26-01","DEMO-JAVA-26-02","DEMO-FE-26-01","DEMO-QA-26-01","DEMO-DATA-26-01"),admin.getTenantId(),admin.getId());
    }

    @Transactional
    public void repair(Collection<String> classCodes,long fallbackTenant,long actorId) {
        var target=tenants.findById(fallbackTenant).orElseThrow();
        if(!Boolean.TRUE.equals(target.getActive())||!Boolean.TRUE.equals(target.getIsActive()))return;
        List<Change> changes=new ArrayList<>();Map<Long,Long> classTenants=new HashMap<>();
        for(String code:classCodes)for(var row:jdbc.queryForList("SELECT class_id,tenant_id FROM training_classes WHERE code=?",code)) {
            long id=((Number)row.get("CLASS_ID")).longValue(),old=((Number)row.get("TENANT_ID")).longValue();
            long resolved=old;
            if(!tenants.existsById(old)) {
                // A published team needs its own explicit migration; never guess its project context.
                if(jdbc.queryForObject("SELECT COUNT(*) FROM project_teams WHERE class_id=?",Long.class,id)>0)continue;
                resolved=fallbackTenant;changes.add(new Change("CLASS",id,old,resolved));
            }
            classTenants.put(id,resolved);
        }
        Map<Long,Set<Long>> userTenants=new HashMap<>();
        for(var row:jdbc.queryForList("SELECT user_id,class_id FROM class_members UNION SELECT user_id,class_id FROM class_staff_assignments")) {
            long c=((Number)row.get("CLASS_ID")).longValue();
            if(classTenants.containsKey(c))userTenants.computeIfAbsent(((Number)row.get("USER_ID")).longValue(),ignored->new HashSet<>()).add(classTenants.get(c));
        }
        for(var entry:userTenants.entrySet()) {
            if(entry.getValue().size()!=1)continue;
            long tenant=entry.getValue().iterator().next();
            if(jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE id=? AND tenant_id IS NULL",Long.class,entry.getKey())==0)continue;
            // Do not fill a tenant if this same user has a conflicting roster outside these classes.
            boolean conflicting=jdbc.queryForList("SELECT DISTINCT c.class_id,c.tenant_id FROM class_members m JOIN training_classes c ON c.class_id=m.class_id WHERE m.user_id=?",entry.getKey())
                    .stream().anyMatch(row->!Objects.equals(classTenants.getOrDefault(((Number)row.get("CLASS_ID")).longValue(),((Number)row.get("TENANT_ID")).longValue()),tenant));
            if(!conflicting)changes.add(new Change("USER",entry.getKey(),null,tenant));
        }
        if(changes.isEmpty())return;
        backup();
        jdbc.execute("CREATE TABLE IF NOT EXISTS legacy_class_context_repairs (entity_type VARCHAR(20) NOT NULL,entity_id BIGINT NOT NULL,old_tenant_id BIGINT,new_tenant_id BIGINT NOT NULL,actor_id BIGINT NOT NULL,repaired_at TIMESTAMP WITH TIME ZONE NOT NULL,PRIMARY KEY(entity_type,entity_id))");
        for(var change:changes) {
            int updated=change.type.equals("CLASS")
                    ?jdbc.update("UPDATE training_classes SET tenant_id=? WHERE class_id=? AND tenant_id=?",change.tenant,change.id,change.previous)
                    :jdbc.update("UPDATE users SET tenant_id=? WHERE id=? AND tenant_id IS NULL",change.tenant,change.id);
            if(updated!=1)throw new IllegalStateException("Existing class context changed while being repaired");
            jdbc.update("INSERT INTO legacy_class_context_repairs(entity_type,entity_id,old_tenant_id,new_tenant_id,actor_id,repaired_at) VALUES (?,?,?,?,?,?)",
                    change.type,change.id,change.previous,change.tenant,actorId,OffsetDateTime.now(ZoneOffset.UTC));
        }
        log.info("Repaired {} existing class/user tenant references; IDs, membership and login locks were retained",changes.size());
    }
    private void backup() {
        try(var connection=jdbc.getDataSource().getConnection()) {
            String url=connection.getMetaData().getURL();
            if(!url.startsWith("jdbc:h2:file:"))return;
            Path database=Path.of(url.substring("jdbc:h2:file:".length()).split(";")[0]).toAbsolutePath().normalize();
            Path directory=database.getParent().resolve("backups");Files.createDirectories(directory);
            Path archive=directory.resolve("before-class-context-"+DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss").withZone(ZoneId.of("Asia/Ho_Chi_Minh")).format(Instant.now())+"-"+UUID.randomUUID()+".zip");
            jdbc.execute("BACKUP TO '"+archive.toString().replace("'","''")+"'");
        } catch(Exception failure) {throw new IllegalStateException("Unable to back up existing class data; no roster context was changed",failure);}
    }
}
