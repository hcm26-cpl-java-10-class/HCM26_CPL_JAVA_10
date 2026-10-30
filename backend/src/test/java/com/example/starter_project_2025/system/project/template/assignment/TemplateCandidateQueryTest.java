package com.example.starter_project_2025.system.project.template.assignment;

import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateVersionStatus;
import com.example.starter_project_2025.system.project.template.ProjectTemplateLevel;
import com.example.starter_project_2025.system.project.template.ProjectTemplateStatus;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.PageRequest;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest(properties = {"spring.jpa.hibernate.ddl-auto=create-drop"})
class TemplateCandidateQueryTest {
    @Autowired ProjectTemplateRepository templates;
    @Autowired ProjectTemplateSnapshotRepository versions;

    @Test
    void combinesKeywordMetadataAndPublishedVersionWithinTenantAndCohort() {
        ProjectTemplate matching = template(1L, 10L, "React Java project", ProjectTemplateStatus.ACTIVE,
                Set.of("REACT", "JAVA"), Set.of("FULLSTACK"), Set.of("REST API"));
        template(2L, 10L, "React Java project", ProjectTemplateStatus.ACTIVE,
                Set.of("REACT"), Set.of("FULLSTACK"), Set.of("REST API"));
        template(1L, 20L, "React Java project", ProjectTemplateStatus.ACTIVE,
                Set.of("REACT"), Set.of("FULLSTACK"), Set.of("REST API"));
        template(1L, 10L, "React Java project", ProjectTemplateStatus.DRAFT,
                Set.of("REACT"), Set.of("FULLSTACK"), Set.of("REST API"));
        template(1L, 10L, "React Java project", ProjectTemplateStatus.ACTIVE,
                Set.of("REACT"), Set.of("FULLSTACK"), Set.of("REST API")); // no published version
        versions.save(ProjectTemplateSnapshot.builder().templateId(matching.getId()).version("v1.0")
                .status(ProjectTemplateVersionStatus.PUBLISHED).contentJson("{}").isActive(true).build());
        var result = templates.findAll(TemplateCandidateService.eligible(
                new TemplateCandidateService.Context(1L, 10L, 5), "spring boot",
                List.of("React", "Java"), ProjectTemplateLevel.INTERMEDIATE, "Web",
                List.of("Fullstack"), List.of("Rest Api")), PageRequest.of(0, 10));
        assertThat(result.getTotalElements()).isEqualTo(1);
        assertThat(result.getContent()).extracting(ProjectTemplate::getId).containsExactly(matching.getId());
    }

    @Test
    void paginationCountsTemplatesOnceAndEmptySearchHasZeroTotal() {
        ProjectTemplate first = template(1L, null, "Alpha", ProjectTemplateStatus.ACTIVE,
                Set.of("REACT", "JAVA"), Set.of("FULLSTACK"), Set.of("REST API"));
        ProjectTemplate second = template(1L, null, "Beta", ProjectTemplateStatus.ACTIVE,
                Set.of("REACT", "JAVA"), Set.of("FULLSTACK"), Set.of("REST API"));
        for (ProjectTemplate template : List.of(first, second)) {
            versions.save(ProjectTemplateSnapshot.builder().templateId(template.getId()).version("v1.0")
                    .status(ProjectTemplateVersionStatus.PUBLISHED).contentJson("{}").isActive(true).build());
        }
        var filter = TemplateCandidateService.eligible(new TemplateCandidateService.Context(1L, 10L, 5),
                null, List.of("REACT", "JAVA"), null, null, List.of(), List.of());
        var firstPage = templates.findAll(filter, PageRequest.of(0, 1, org.springframework.data.domain.Sort.by("name")));
        var secondPage = templates.findAll(filter, PageRequest.of(1, 1, org.springframework.data.domain.Sort.by("name")));
        assertThat(firstPage.getTotalElements()).isEqualTo(2);
        assertThat(firstPage.getContent()).extracting(ProjectTemplate::getName).containsExactly("Alpha");
        assertThat(secondPage.getContent()).extracting(ProjectTemplate::getName).containsExactly("Beta");
        assertThat(templates.findAll(TemplateCandidateService.eligible(
                new TemplateCandidateService.Context(1L, 10L, 5), "missing",
                List.of(), null, null, List.of(), List.of()), PageRequest.of(0, 1)).getTotalElements())
                .isZero();
    }

    private ProjectTemplate template(Long tenantId, Long cohortId, String name,
            ProjectTemplateStatus status, Set<String> tech, Set<String> roles, Set<String> outcomes) {
        return templates.save(ProjectTemplate.builder().tenantId(tenantId).cohortId(cohortId)
                .code("T-" + java.util.UUID.randomUUID()).name(name)
                .description("A Spring Boot brief").category("Web").level(ProjectTemplateLevel.INTERMEDIATE)
                .status(status).technologies(tech).targetRoles(roles).learningOutcomes(outcomes)
                .isActive(true).build());
    }
}
