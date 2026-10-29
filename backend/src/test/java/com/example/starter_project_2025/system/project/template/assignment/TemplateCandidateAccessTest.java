package com.example.starter_project_2025.system.project.template.assignment;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.TeamAllocationSession;
import com.example.starter_project_2025.system.project.TeamAllocationSessionRepository;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClass;
import com.example.starter_project_2025.system.rbac.user.User;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;

@ExtendWith(MockitoExtension.class)
class TemplateCandidateAccessTest {
    @Mock com.example.starter_project_2025.system.project.ProjectTemplateRepository templates;
    @Mock com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotRepository versions;
    @Mock TeamAllocationSessionRepository sessions;
    @Mock com.example.starter_project_2025.system.project.ProjectTeamRepository teams;
    @Mock com.example.starter_project_2025.system.project.ProjectMemberRepository members;
    @Mock com.example.starter_project_2025.system.project.trainingclass.ScopeAuthorizationService scope;
    @Mock com.fasterxml.jackson.databind.ObjectMapper mapper;
    @Mock TemplateSearchAuditWriter audit;
    @InjectMocks TemplateCandidateService service;

    @Test
    void studentIsDeniedAndAuditedBeforeAnyTemplateQuery() {
        var actor = authentication("ROLE_STUDENT", 1L);
        assertThatThrownBy(() -> service.search(10L, 20L, 30L, actor,
                null, List.of(), null, null, List.of(), List.of(), 0, 12))
                .isInstanceOf(AccessDeniedException.class);
        verify(audit).denied(7L, 1L, 10L, 30L, "ROLE_DENIED");
    }

    @Test
    void mentorFromAnotherTenantIsDeniedAndAudited() {
        var actor = authentication("ROLE_MENTOR", 1L);
        var trainingClass = TrainingClass.builder().id(10L).tenantId(2L).build();
        when(sessions.findByIdAndTrainingClass_Id(20L, 10L)).thenReturn(Optional.of(
                TeamAllocationSession.builder().trainingClass(trainingClass).build()));
        assertThatThrownBy(() -> service.search(10L, 20L, 30L, actor,
                null, List.of(), null, null, List.of(), List.of(), 0, 12))
                .isInstanceOf(AccessDeniedException.class);
        verify(audit).denied(7L, 1L, 10L, 30L, "TENANT_DENIED");
    }

    @Test
    void mentorWithoutClassScopeIsDeniedAndAudited() {
        var actor = authentication("ROLE_MENTOR", 1L);
        var trainingClass = TrainingClass.builder().id(10L).tenantId(1L).build();
        when(sessions.findByIdAndTrainingClass_Id(20L, 10L)).thenReturn(Optional.of(
                TeamAllocationSession.builder().trainingClass(trainingClass).build()));
        doThrow(new AccessDeniedException("outside scope"))
                .when(scope).assertCanSearchProjectTemplates(actor, trainingClass);
        assertThatThrownBy(() -> service.search(10L, 20L, 30L, actor,
                null, List.of(), null, null, List.of(), List.of(), 0, 12))
                .isInstanceOf(AccessDeniedException.class);
        verify(audit).denied(7L, 1L, 10L, 30L, "SCOPE_DENIED");
    }

    private UsernamePasswordAuthenticationToken authentication(String role, Long tenantId) {
        User user = User.builder().id(7L).tenantId(tenantId).isActive(true).build();
        var authorities = List.of(new SimpleGrantedAuthority(role));
        return new UsernamePasswordAuthenticationToken(new UserPrincipal(user, authorities), null, authorities);
    }
}
