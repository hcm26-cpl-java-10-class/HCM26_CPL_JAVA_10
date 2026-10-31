package com.example.starter_project_2025.system.project.template;

import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotService;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneRepository;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneScheduleValidator;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneValidator;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneRubrics;
import com.example.starter_project_2025.system.rbac.user.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TemplateActivationServiceTest {
    @Mock ProjectTemplateRepository templates;
    @Mock TemplateMilestoneRepository milestones;
    @Mock ProjectTemplateAccessService access;
    @Mock ProjectTemplateValidator validator;
    @Mock TemplateMilestoneValidator milestoneValidator;
    @Mock TemplateMilestoneScheduleValidator scheduleValidator;
    @Mock TemplateTeamConstraintsMapper constraintsMapper;
    @Mock ProjectTemplateAuditRepository audits;
    @Spy ObjectMapper objectMapper = new ObjectMapper();
    @Mock TemplateMilestoneRubrics rubrics;
    @Mock ProjectTemplateSnapshotService snapshots;
    @InjectMocks TemplateActivationService service;

    @Test
    void activatingVersionTwoArchivesPreviousActiveVersionAndPublishesOnlyNewBaseline() {
        User user = mock(User.class);
        when(user.getTenantId()).thenReturn(7L);
        when(user.getId()).thenReturn(9L);
        when(access.requireUser("ACTIVATE")).thenReturn(user);
        ProjectTemplate v1 = ProjectTemplate.builder().tenantId(7L).code("TPL-A").name("A")
                .templateVersion(1).status(ProjectTemplateStatus.ACTIVE).constraintsJson("{}")
                .estimatedDurationWeeks(8).build();
        v1.setId(1L);
        ProjectTemplate v2 = ProjectTemplate.builder().tenantId(7L).code("TPL-A").name("A")
                .templateVersion(2).versionFamilyId(1L).status(ProjectTemplateStatus.DRAFT)
                .constraintsJson("{}").estimatedDurationWeeks(8).build();
        v2.setId(2L);
        v2.setLockVersion(0L);
        when(templates.findForTemplateUpdate(2L, 7L)).thenReturn(Optional.of(v2));
        when(templates.findForTemplateUpdate(1L, 7L)).thenReturn(Optional.of(v1));
        when(templates.findVersionFamily(1L)).thenReturn(List.of(v2, v1));
        when(templates.saveAndFlush(any(ProjectTemplate.class))).thenAnswer(call -> call.getArgument(0));
        when(milestones.findAllByTemplate_IdOrderByOrderIndexAscIdAsc(any())).thenReturn(List.of());
        when(constraintsMapper.read("{}"))
                .thenReturn(new TemplateTeamConstraints(1, 4, new TemplateTeamConstraints.RoleQuotas(0, 0, 0, 0), true));

        service.activate(2L, new TemplateActivationRequest(BigDecimal.ZERO));

        assertEquals(ProjectTemplateStatus.ARCHIVED, v1.getStatus());
        assertEquals(ProjectTemplateStatus.ACTIVE, v2.getStatus());
        verify(snapshots).archivePublishedVersion(v1);
        verify(snapshots).publishLatestVersion(v2);
    }
}
