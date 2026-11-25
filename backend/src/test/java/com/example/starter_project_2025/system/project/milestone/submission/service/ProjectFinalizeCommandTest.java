package com.example.starter_project_2025.system.project.milestone.submission.service;

import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.milestone.exception.MilestoneConflictException;
import com.example.starter_project_2025.system.project.milestone.integration.port.CurrentActorProvider;
import com.example.starter_project_2025.system.project.milestone.integration.port.MilestoneTenantProvider;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.submission.domain.ProjectCompletionAudit;
import com.example.starter_project_2025.system.project.milestone.submission.dto.SubmissionDtos;
import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneWaiverRepository;
import com.example.starter_project_2025.system.project.milestone.submission.repository.ProjectCompletionAuditRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.ZoneOffset;

import static com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneExecutionStatus.*;
import static com.example.starter_project_2025.system.project.milestone.submission.service.ProjectFinalizeFixture.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class ProjectFinalizeCommandTest {
    private final ProjectFinalizeFixture fixture = new ProjectFinalizeFixture();
    private final ProjectCompletionAuditRepository audits = mock(ProjectCompletionAuditRepository.class);
    private final MilestoneTenantProvider tenants = () -> TENANT;
    private final CurrentActorProvider actors = () -> ACTOR;
    private final ProjectCompletionCommandService commands = new ProjectCompletionCommandService(
            fixture.gradeRepository, mock(MilestoneWaiverRepository.class), mock(MilestoneRepository.class),
            fixture.completionService(), tenants, actors, Clock.fixed(NOW, ZoneOffset.UTC), fixture.port, audits,
            fixture.readiness());
    private final Project master = fixture.project(1L, null, ProjectStatus.ACTIVE);
    private final Project module = fixture.project(2L, master, ProjectStatus.ACTIVE);

    private static SubmissionDtos.FinalizeProjectRequest score(String value) {
        return new SubmissionDtos.FinalizeProjectRequest(new BigDecimal(value), "Good work");
    }

    @Test
    void refusesToFinalizeWhileMandatoryMilestonesArePending() {
        fixture.milestone(module.getId(), true, IN_PROGRESS);

        assertThatThrownBy(() -> commands.finalizeProject(module.getId(), TEAM, score("80")))
                .isInstanceOf(ProjectNotReadyException.class).hasMessageContaining("1 mandatory milestone");
        assertThat(fixture.grades).isEmpty();
        assertThat(module.getStatus()).isEqualTo(ProjectStatus.ACTIVE);
    }

    @Test
    void finalizingAReadyModuleLocksTheGradeCompletesItAndAudits() {
        fixture.milestone(module.getId(), true, DONE);

        var result = commands.finalizeProject(module.getId(), TEAM, score("87.5"));

        assertThat(result.completed()).isTrue();
        assertThat(module.getStatus()).isEqualTo(ProjectStatus.COMPLETED);
        assertThat(fixture.grades.get(module.getId()).getFinalScore()).isEqualByComparingTo("87.50");
        var audit = ArgumentCaptor.forClass(ProjectCompletionAudit.class);
        verify(audits).save(audit.capture());
        assertThat(audit.getValue().getAction()).isEqualTo("PROJECT_FINALIZED");
        assertThat(audit.getValue().getDetail()).isEqualTo("87.50 | Good work");
    }

    @Test
    void finalizingTheLastModuleDoesNotCompleteTheMaster() {
        fixture.milestone(master.getId(), true, DONE);
        fixture.milestone(module.getId(), true, DONE);

        commands.finalizeProject(module.getId(), TEAM, score("90"));

        assertThat(master.getStatus()).isEqualTo(ProjectStatus.ACTIVE);
        assertThat(fixture.readiness().evaluate(TENANT, master.getId(), TEAM).ready()).isTrue();
    }

    @Test
    void masterCannotBeFinalizedBeforeItsModulesThenCanAfterwards() {
        fixture.milestone(master.getId(), true, DONE);

        assertThatThrownBy(() -> commands.finalizeProject(master.getId(), TEAM, score("85")))
                .isInstanceOf(ProjectNotReadyException.class).hasMessageContaining("1 child project");

        commands.finalizeProject(module.getId(), TEAM, score("90"));
        commands.finalizeProject(master.getId(), TEAM, score("85"));

        assertThat(master.getStatus()).isEqualTo(ProjectStatus.COMPLETED);
    }

    @Test
    void repeatingWithTheSameScoreIsIdempotentAndADifferentScoreIsRejected() {
        commands.finalizeProject(module.getId(), TEAM, score("70"));

        assertThat(commands.finalizeProject(module.getId(), TEAM, score("70.00")).trigger()).isEqualTo("ALREADY_FINALIZED");
        assertThatThrownBy(() -> commands.finalizeProject(module.getId(), TEAM, score("71")))
                .isInstanceOf(MilestoneConflictException.class).isNotInstanceOf(ProjectNotReadyException.class);
        verify(audits, times(1)).save(any());
    }

    @Test
    void legacyGradeLockedWithAnotherScoreIsNotSilentlyReplaced() {
        fixture.lockGrade(module.getId(), "60");

        assertThatThrownBy(() -> commands.finalizeProject(module.getId(), TEAM, score("75")))
                .isInstanceOf(MilestoneConflictException.class).hasMessageContaining("60.00");
        assertThat(module.getStatus()).isEqualTo(ProjectStatus.ACTIVE);
    }

    @Test
    void deprecatedLockEndpointAppliesTheSameReadinessRules() {
        fixture.milestone(module.getId(), true, IN_PROGRESS);

        assertThatThrownBy(() -> commands.lockFinalGrade(module.getId(), TEAM,
                new SubmissionDtos.LockFinalGradeRequest(new BigDecimal("80")))).isInstanceOf(ProjectNotReadyException.class);
        assertThat(fixture.grades).isEmpty();
    }

    @Test
    void managementPermissionIsRequired() {
        var denyingPort = spy(fixture.port);
        doThrow(new AccessDeniedException("no")).when(denyingPort).requireManagement(any(), any(), any());
        var guarded = new ProjectCompletionCommandService(fixture.gradeRepository, mock(MilestoneWaiverRepository.class),
                mock(MilestoneRepository.class), fixture.completionService(), tenants, actors,
                Clock.fixed(NOW, ZoneOffset.UTC), denyingPort, audits, fixture.readiness());

        assertThatThrownBy(() -> guarded.finalizeProject(module.getId(), TEAM, score("80"))).isInstanceOf(AccessDeniedException.class);
        assertThat(module.getStatus()).isEqualTo(ProjectStatus.ACTIVE);
    }

    @Test
    void completedProjectRejectsFurtherAssessmentChanges() {
        commands.finalizeProject(module.getId(), TEAM, score("80"));

        assertThatThrownBy(() -> fixture.completionService().requireActive(TENANT, module.getId()))
                .isInstanceOf(MilestoneConflictException.class);
    }
}
