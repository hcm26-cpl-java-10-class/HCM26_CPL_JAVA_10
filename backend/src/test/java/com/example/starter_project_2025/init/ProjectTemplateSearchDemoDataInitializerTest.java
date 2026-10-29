package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateVersionStatus;
import com.example.starter_project_2025.system.project.template.ProjectTemplateStatus;
import com.example.starter_project_2025.system.project.template.backlog.TemplateBacklogItemRepository;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneRepository;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClass;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClassRepository;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClassStatus;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
class ProjectTemplateSearchDemoDataInitializerTest {
    @Autowired UserRepository users;
    @Autowired TenantRepository tenants;
    @Autowired TrainingClassRepository classes;
    @Autowired ProjectTemplateRepository templates;
    @Autowired ProjectTemplateSnapshotRepository versions;
    @Autowired TemplateMilestoneRepository milestones;
    @Autowired TemplateBacklogItemRepository backlog;

    @Test
    void createsIsolatedPublishedFixturesAndRerunIsIdempotent() throws Exception {
        Tenant tenant = tenants.saveAndFlush(Tenant.builder().code("USPRJ001-TEST-HOME")
                .name("Fixture home").active(true).isActive(true).build());
        users.saveAndFlush(User.builder().email("seed-test@example.com").passwordHash("unused")
                .firstName("Seed").tenantId(tenant.getId()).isActive(true).build());
        classes.saveAndFlush(trainingClass(tenant.getId(), "USPRJ001-CLASS-A", 1001L));
        classes.saveAndFlush(trainingClass(tenant.getId(), "USPRJ001-CLASS-B", 1002L));

        var initializer = new ProjectTemplateSearchDemoDataInitializer(users, tenants, classes,
                templates, versions, milestones, backlog, new ObjectMapper());
        ReflectionTestUtils.setField(initializer, "adminEmail", "seed-test@example.com");
        initializer.run();
        initializer.run();

        var fixtureRows = templates.findAll().stream()
                .filter(row -> row.getCode().startsWith("USPRJ001-"))
                .toList();
        assertThat(fixtureRows).hasSize(29);
        assertThat(fixtureRows.stream().filter(row -> row.getTenantId().equals(tenant.getId())
                && row.getStatus() == ProjectTemplateStatus.ACTIVE).count()).isEqualTo(25);
        assertThat(fixtureRows.stream().filter(row -> !row.getTenantId().equals(tenant.getId())).count())
                .isEqualTo(2);
        var first = fixtureRows.stream().filter(row -> "USPRJ001-01".equals(row.getCode()))
                .findFirst().orElseThrow();
        assertThat(first.getTechnologies()).contains("REACT", "JAVA");
        assertThat(first.getTargetRoles()).contains("FULLSTACK");
        assertThat(fixtureRows.stream().filter(row -> "USPRJ001-13".equals(row.getCode()))
                .findFirst().orElseThrow().getConstraintsJson()).contains("\"min_members\":2", "\"max_members\":4");
        assertThat(fixtureRows.stream().filter(row -> "USPRJ001-17".equals(row.getCode()))
                .findFirst().orElseThrow().getConstraintsJson()).contains("\"min_members\":5", "\"max_members\":8");
        assertThat(versions.findFirstByTemplateIdAndStatusAndIsActiveTrueOrderByCreatedAtDescIdDesc(
                first.getId(), ProjectTemplateVersionStatus.PUBLISHED)).isPresent();
        assertThat(milestones.findAllByTemplate_IdOrderByOrderIndexAscIdAsc(first.getId())).hasSize(2);
        assertThat(backlog.findAllByTemplate_IdOrderByOrderIndexAscIdAsc(first.getId())).hasSize(2);
    }

    private TrainingClass trainingClass(Long tenantId, String code, Long cohortId) {
        return TrainingClass.builder().code(code).name(code).tenantId(tenantId)
                .programId(1L).cohortId(cohortId).cohortName("Cohort " + cohortId)
                .status(TrainingClassStatus.ONGOING).isActive(true).build();
    }
}
