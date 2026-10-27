package com.example.starter_project_2025.system.project.domain;

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
class ProjectTenantPersistenceTest {
    @Autowired private TestEntityManager entityManager;

    @Test
    void workspaceCanAssignTenantAssociation() {
        Tenant tenant = tenant();
        Project project = project();
        project.setTenant(tenant);
        assertTenantSurvivesReload(project, tenant.getId());
    }

    @Test
    void boardCanAssignTenantId() {
        Tenant tenant = tenant();
        Project project = project();
        project.setTenantId(tenant.getId());
        assertTenantSurvivesReload(project, tenant.getId());
    }

    @Test
    void builderCanAssignTenantAssociation() {
        Tenant tenant = tenant();
        Project project = Project.builder().code(UUID.randomUUID().toString()).name("Builder project")
                .tenant(tenant).status(ProjectStatus.PLANNING).build();
        assertTenantSurvivesReload(project, tenant.getId());
    }

    private Tenant tenant() {
        Tenant tenant = new Tenant();
        tenant.setCode(UUID.randomUUID().toString());
        tenant.setName("Tenant mapping test");
        return entityManager.persistAndFlush(tenant);
    }

    private Project project() {
        Project project = new Project();
        project.setCode(UUID.randomUUID().toString());
        project.setName("Project mapping test");
        project.setStatus(ProjectStatus.PLANNING);
        return project;
    }

    private void assertTenantSurvivesReload(Project project, Long tenantId) {
        Long projectId = entityManager.persistAndFlush(project).getId();
        entityManager.clear();
        Project saved = entityManager.find(Project.class, projectId);
        assertEquals(tenantId, saved.getTenantId());
        assertEquals(tenantId, saved.getTenant().getId());
    }
}
