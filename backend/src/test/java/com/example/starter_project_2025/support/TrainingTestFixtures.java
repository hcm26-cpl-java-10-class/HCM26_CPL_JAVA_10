package com.example.starter_project_2025.support;

import com.example.starter_project_2025.system.rbac.permission.Permission;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.subject.Subject;
import com.example.starter_project_2025.system.subject.SubjectStatus;
import jakarta.persistence.EntityManager;
import org.hibernate.Session;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Explicit per-test fixtures, rolled back by the caller; never application startup seed data. */
public final class TrainingTestFixtures {
    private TrainingTestFixtures() {}

    public static void create(EntityManager em, String... authorities) {
        if (!em.isJoinedToTransaction()) throw new IllegalStateException("A rollback-only test transaction is required");
        em.unwrap(Session.class).doWork(connection -> {
            if (!connection.getMetaData().getURL().startsWith("jdbc:h2:mem:"))
                throw new IllegalStateException("Test fixtures require an isolated in-memory H2 database");
        });
        var permissions = new HashSet<Permission>();
        for (String authority : authorities) {
            int separator = authority.lastIndexOf('_');
            var permission = new Permission();
            permission.setName(authority);
            permission.setResource(authority.substring(0, separator));
            permission.setAction(authority.substring(separator + 1));
            permission.setDescription("Rollback-only test fixture");
            em.persist(permission);
            permissions.add(permission);
        }
        var admin = new Role(); admin.setName("TEST_TRAINING_ADMIN"); admin.setPermissions(permissions); em.persist(admin);
        var student = new Role(); student.setName("TEST_NO_TRAINING_ACCESS"); em.persist(student);
        for (var entry : List.of(Map.entry("admin@example.com", admin), Map.entry("student@example.com", student))) {
            var user = new User(); user.setEmail(entry.getKey()); user.setFirstName("Test"); user.setLastName("Fixture");
            user.setPasswordHash("unused-test-hash"); user.setRoles(new HashSet<>(Set.of(entry.getValue()))); em.persist(user);
        }
        var topic = new Subject(); topic.setCode("TEST_TEACHING_TOPIC"); topic.setName("Test teaching topic");
        topic.setVersion("1"); topic.setDurationHours(1); topic.setStatus(SubjectStatus.ACTIVE); em.persist(topic);
        em.flush();
    }
}
