package com.example.starter_project_2025.system.project.milestone.submission.service;

import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.milestone.submission.service.ProjectCompletionReadiness.PendingChild;
import com.example.starter_project_2025.system.project.milestone.submission.service.ProjectCompletionReadiness.PendingMilestone;
import com.example.starter_project_2025.system.project.milestone.submission.service.ProjectCompletionReadiness.Readiness;
import org.junit.jupiter.api.Test;

import static com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneExecutionStatus.*;
import static com.example.starter_project_2025.system.project.milestone.submission.service.ProjectFinalizeFixture.TEAM;
import static com.example.starter_project_2025.system.project.milestone.submission.service.ProjectFinalizeFixture.TENANT;
import static org.assertj.core.api.Assertions.assertThat;

class ProjectCompletionReadinessTest {
    private final ProjectFinalizeFixture fixture = new ProjectFinalizeFixture();
    private final ProjectCompletionReadiness readiness = fixture.readiness();
    private final Project master = fixture.project(1L, null, ProjectStatus.ACTIVE);

    @Test
    void moduleWithUnacceptedMandatoryMilestoneIsNotReady() {
        Project module = fixture.project(2L, master, ProjectStatus.ACTIVE);
        fixture.milestone(module.getId(), true, DONE);
        var pending = fixture.milestone(module.getId(), true, IN_PROGRESS);

        var result = readiness.evaluate(TENANT, module.getId(), TEAM);

        assertThat(result.readiness()).isEqualTo(Readiness.MILESTONES_PENDING);
        assertThat(result.pendingMilestones()).extracting(PendingMilestone::id).containsExactly(pending.getId());
    }

    @Test
    void moduleWithAcceptedOrWaivedMandatoryMilestonesIsReadyEvenWithOptionalWorkOpen() {
        Project module = fixture.project(2L, master, ProjectStatus.ACTIVE);
        fixture.milestone(module.getId(), true, DONE);
        fixture.waive(fixture.milestone(module.getId(), true, FAILED));
        fixture.milestone(module.getId(), false, IN_PROGRESS);

        assertThat(readiness.evaluate(TENANT, module.getId(), TEAM).readiness()).isEqualTo(Readiness.READY);
    }

    @Test
    void masterWithDoneMilestonesWaitsForIncompleteChildren() {
        fixture.milestone(master.getId(), true, DONE);
        fixture.project(2L, master, ProjectStatus.COMPLETED);
        Project open = fixture.project(3L, master, ProjectStatus.ACTIVE);

        var result = readiness.evaluate(TENANT, master.getId(), TEAM);

        assertThat(result.readiness()).isEqualTo(Readiness.CHILDREN_PENDING);
        assertThat(result.pendingChildren()).extracting(PendingChild::id).containsExactly(open.getId());
    }

    @Test
    void masterIsReadyWhenEveryActiveChildIsCompletedAndItsMilestonesAreDone() {
        fixture.milestone(master.getId(), true, DONE);
        fixture.project(2L, master, ProjectStatus.COMPLETED);
        fixture.project(3L, master, ProjectStatus.ACTIVE).setIsActive(false);

        assertThat(readiness.evaluate(TENANT, master.getId(), TEAM).readiness()).isEqualTo(Readiness.READY);
    }

    @Test
    void pendingMilestonesTakePrecedenceButBothReasonsAreReported() {
        fixture.milestone(master.getId(), true, IN_PROGRESS);
        fixture.project(2L, master, ProjectStatus.ACTIVE);

        var result = readiness.evaluate(TENANT, master.getId(), TEAM);

        assertThat(result.readiness()).isEqualTo(Readiness.MILESTONES_PENDING);
        assertThat(result.pendingMilestones()).hasSize(1);
        assertThat(result.pendingChildren()).hasSize(1);
    }

    @Test
    void completedAndInactiveProjectsAreReportedAsSuch() {
        Project done = fixture.project(2L, master, ProjectStatus.COMPLETED);
        Project planning = fixture.project(3L, master, ProjectStatus.PLANNING);

        assertThat(readiness.evaluate(TENANT, done.getId(), TEAM).readiness()).isEqualTo(Readiness.COMPLETED);
        assertThat(readiness.evaluate(TENANT, planning.getId(), TEAM).readiness()).isEqualTo(Readiness.INACTIVE);
    }

    @Test
    void unpublishedMandatoryMilestoneBlocksAndIsFlaggedAsDraft() {
        Project module = fixture.project(2L, master, ProjectStatus.ACTIVE);
        fixture.milestone(module.getId(), true, null);

        var result = readiness.evaluate(TENANT, module.getId(), TEAM);

        assertThat(result.readiness()).isEqualTo(Readiness.MILESTONES_PENDING);
        assertThat(result.pendingMilestones()).singleElement().extracting(PendingMilestone::draft).isEqualTo(true);
    }

    @Test
    void milestonesOfAnotherTeamOnTheSameProjectAreIgnored() {
        Project module = fixture.project(2L, master, ProjectStatus.ACTIVE);
        fixture.milestone(module.getId(), 99L, true, IN_PROGRESS);

        assertThat(readiness.evaluate(TENANT, module.getId(), TEAM).readiness()).isEqualTo(Readiness.READY);
    }
}
