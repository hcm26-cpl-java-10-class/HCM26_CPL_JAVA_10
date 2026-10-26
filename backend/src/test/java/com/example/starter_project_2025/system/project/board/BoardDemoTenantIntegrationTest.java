package com.example.starter_project_2025.system.project.board;

import com.example.starter_project_2025.init.BoardDemoDataInitializer;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {"app.seed.board.enabled=true", "app.seed.team-allocation.enabled=false"})
@ActiveProfiles("test")
@Transactional
class BoardDemoTenantIntegrationTest {
    @Autowired private BoardDemoDataInitializer initializer;
    @Autowired private UserRepository users;
    @Autowired private ProjectRepository projects;
    @Autowired private EntityManager entityManager;

    @Test
    void boardSeedReusesSharedTenantWithoutReassigningExistingAccounts() {
        Long tenantId = users.findByEmail("admin@example.com").orElseThrow().getTenantId();
        assertThat(users.findByEmail("student@example.com").orElseThrow().getTenantId()).isEqualTo(tenantId);
        assertThat(users.findByEmail("teacher@example.com").orElseThrow().getTenantId()).isEqualTo(tenantId);

        initializer.run();
        entityManager.flush();
        entityManager.clear();

        assertThat(users.findByEmail("student@example.com").orElseThrow().getTenant().getId()).isEqualTo(tenantId);
        assertThat(users.findByEmail("teacher@example.com").orElseThrow().getTenant().getId()).isEqualTo(tenantId);
        assertThat(projects.findByCodeAndTenantId("DEMO-BOARD", tenantId)).isPresent();
    }
}
