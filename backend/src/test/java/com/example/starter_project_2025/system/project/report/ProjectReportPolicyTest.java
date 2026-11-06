package com.example.starter_project_2025.system.project.report;

import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneLifecycleStatus;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static com.example.starter_project_2025.system.project.report.ProjectReportDtos.Status;
import static com.example.starter_project_2025.system.project.milestone.domain.MilestoneLifecycleStatus.*;

class ProjectReportPolicyTest {
    final ProjectReportProgressPolicy progress = new ProjectReportProgressPolicy();
    final ProjectReportStatusPolicy status = new ProjectReportStatusPolicy();
    ProjectReportProgressPolicy.Stage stage(int percent,Integer weight) {
        return new ProjectReportProgressPolicy.Stage(BigDecimal.valueOf(percent),weight==null?null:BigDecimal.valueOf(weight));
    }
    @Test void reportsOverrideRequiresNonemptyAcceptedMilestonesAndCancellationTakesPriority() {
        assertThat(status.evaluate(ProjectStatus.ACTIVE,List.of())).isEqualTo(Status.IN_PROGRESS);
        assertThat(status.evaluate(ProjectStatus.PLANNING,List.of())).isEqualTo(Status.NOT_STARTED);
        assertThat(status.evaluate(ProjectStatus.ACTIVE,List.of(ACCEPTED,ACCEPTED))).isEqualTo(Status.DONE);
        assertThat(status.evaluate(ProjectStatus.ACTIVE,List.of(ACCEPTED,PLANNED))).isEqualTo(Status.IN_PROGRESS);
        assertThat(status.evaluate(ProjectStatus.CANCELLED,List.of(ACCEPTED))).isEqualTo(Status.CANCELLED);
        assertThat(status.evaluate(ProjectStatus.COMPLETED,List.of(PLANNED))).isEqualTo(Status.DONE);
    }
    @Test void submissionIsOneExclusiveStateEvenWhenOtherMilestonesAreStillInProgress() {
        assertThat(status.evaluate(ProjectStatus.ACTIVE,List.of(SUBMITTED,IN_PROGRESS))).isEqualTo(Status.SUBMITTED);
        assertThat(status.evaluate(ProjectStatus.PLANNING,List.of(SUBMITTED))).isEqualTo(Status.SUBMITTED);
    }
    @Test void acceptedMilestoneIsCompleteRegardlessOfItsTasks() {
        assertThat(progress.milestone(ACCEPTED,0,3)).isEqualByComparingTo("100");
        assertThat(progress.milestone(IN_PROGRESS,1,3)).isEqualByComparingTo("33.33333333");
        assertThat(progress.milestone(PLANNED,0,0)).isZero();
    }
    @Test void configuredWeightsAndEqualFallbackHaveDifferentResults() {
        assertThat(progress.project(Status.IN_PROGRESS,List.of(stage(100,40),stage(30,60)),ProjectReportQueryRepository.TaskCount.empty()).value()).isEqualByComparingTo("58");
        var equal=progress.project(Status.IN_PROGRESS,List.of(stage(100,null),stage(30,0)),ProjectReportQueryRepository.TaskCount.empty());
        assertThat(equal.value()).isEqualByComparingTo("65");assertThat(equal.mode()).isEqualTo("EQUAL");
    }
    @Test void partialOrInvalidWeightsDoNotInventPercentagesOrHideMissingTeams() {
        assertThat(progress.project(Status.IN_PROGRESS,List.of(stage(100,40),stage(30,null)),ProjectReportQueryRepository.TaskCount.empty()).value()).isNull();
        assertThat(progress.project(Status.IN_PROGRESS,List.of(stage(100,40),stage(30,40)),ProjectReportQueryRepository.TaskCount.empty()).value()).isNull();
        assertThat(progress.average(Arrays.asList(BigDecimal.TEN,null))).isNull();
        assertThat(progress.average(List.of())).isNull();
        assertThat(progress.project(Status.DONE,List.of(stage(0,null)),ProjectReportQueryRepository.TaskCount.empty()).value()).isEqualByComparingTo("100");
    }
    ProjectReportRiskPolicy risks() {
        var settings=new ProjectReportSettings();ReflectionTestUtils.setField(settings,"atRiskHours",48L);
        ReflectionTestUtils.setField(settings,"atRiskThreshold",new BigDecimal("50"));return new ProjectReportRiskPolicy(settings);
    }
    @Test void riskBoundariesUseStrictDeadlineAndProgressThreshold() {
        var policy=risks();var now=Instant.parse("2026-10-30T12:00:00Z");
        assertThat(policy.evaluate(IN_PROGRESS,now.plusSeconds(48*3600),new BigDecimal("49.99"),false,false,now).atRisk()).isTrue();
        assertThat(policy.evaluate(IN_PROGRESS,now.plusSeconds(48*3600+1),BigDecimal.ZERO,false,false,now).atRisk()).isFalse();
        assertThat(policy.evaluate(IN_PROGRESS,now.plusSeconds(1),new BigDecimal("50"),false,false,now).atRisk()).isFalse();
        assertThat(policy.evaluate(IN_PROGRESS,now,BigDecimal.ZERO,false,false,now).overdue()).isFalse();
        assertThat(policy.evaluate(IN_PROGRESS,now.minusSeconds(1),BigDecimal.ZERO,false,false,now).overdue()).isTrue();
    }
    @Test void onTimeSubmissionAwaitingGradingIsNotOverdueAndLateHistorySurvivesAcceptance() {
        var now=Instant.parse("2026-10-30T12:00:00Z");var policy=risks();
        assertThat(policy.evaluate(SUBMITTED,now.minusSeconds(1),BigDecimal.ZERO,false,false,now).overdue()).isFalse();
        var accepted=policy.evaluate(ACCEPTED,now.minusSeconds(1),BigDecimal.ZERO,true,true,now);
        assertThat(accepted.overdue()).isFalse();assertThat(accepted.late()).isTrue();assertThat(accepted.atRisk()).isFalse();
    }
    @Test void missingDeadlineAndClosedProjectHaveNoCurrentRisk() {
        var now=Instant.parse("2026-10-30T12:00:00Z");
        assertThat(risks().evaluate(PLANNED,null,BigDecimal.ZERO,false,false,now)).isEqualTo(new ProjectReportRiskPolicy.Flags(false,false,false));
        assertThat(risks().evaluate(MilestoneLifecycleStatus.REJECTED,now.minusSeconds(1),BigDecimal.ZERO,false,true,now).overdue()).isFalse();
    }
    @Test void assignmentCopiesResolveToSourceButPublishedChildVersionKeepsItsOwnIdentity() {
        var query=new ProjectReportQueryRepository(null,null,new com.fasterxml.jackson.databind.ObjectMapper());
        var snapshot=new com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot();
        snapshot.setId(21L);snapshot.setParentTemplateId(10L);snapshot.setContentJson("{}");
        assertThat(query.sourceVersionId(snapshot)).isEqualTo(21L);
        snapshot.setContentJson("{\"purpose\":\"TEAM_ASSIGNMENT\"}");
        assertThat(query.sourceVersionId(snapshot)).isEqualTo(10L);
        snapshot.setParentTemplateId(null);assertThat(query.sourceVersionId(snapshot)).isNull();
    }
}
