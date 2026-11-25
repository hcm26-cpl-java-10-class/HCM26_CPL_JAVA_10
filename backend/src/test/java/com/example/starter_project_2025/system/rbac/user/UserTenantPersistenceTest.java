package com.example.starter_project_2025.system.rbac.user;

import com.example.starter_project_2025.system.project.tenant.Tenant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;

@DataJpaTest
@ActiveProfiles("test")
class UserTenantPersistenceTest {
    @Autowired private TestEntityManager entityManager;

    @Test
    void workspaceCanAssignTenantAssociation() {
        Tenant tenant = tenant();
        User user = user();
        user.setTenant(tenant);
        assertTenantSurvivesReload(user, tenant.getId());
    }

    @Test
    void boardCanAssignTenantId() {
        Tenant tenant = tenant();
        User user = user();
        user.setTenantId(tenant.getId());
        assertTenantSurvivesReload(user, tenant.getId());
    }

    @Test
    void builderCanAssignTenantAssociation() {
        Tenant tenant = tenant();
        User user = User.builder().email(UUID.randomUUID() + "@tenant.test").passwordHash("unused")
                .firstName("Builder user").tenant(tenant).build();
        assertTenantSurvivesReload(user, tenant.getId());
    }

    private Tenant tenant() {
        Tenant tenant = new Tenant();
        tenant.setCode(UUID.randomUUID().toString());
        tenant.setName("Tenant mapping test");
        return entityManager.persistAndFlush(tenant);
    }

    private User user() {
        User user = new User();
        user.setEmail(UUID.randomUUID() + "@tenant.test");
        user.setPasswordHash("unused");
        user.setFirstName("User mapping test");
        return user;
    }

    private void assertTenantSurvivesReload(User user, Long tenantId) {
        Long userId = entityManager.persistAndFlush(user).getId();
        entityManager.clear();
        User saved = entityManager.find(User.class, userId);
        assertEquals(tenantId, saved.getTenantId());
        assertEquals(tenantId, saved.getTenant().getId());
    }
}
