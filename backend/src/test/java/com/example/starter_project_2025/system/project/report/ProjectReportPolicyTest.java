package com.example.starter_project_2025.system.project.report;

import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.sprint_backlog.*;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static com.example.starter_project_2025.system.project.report.ProjectReportDtos.*;
import static com.example.starter_project_2025.system.project.milestone.domain.MilestoneLifecycleStatus.*;

class ProjectReportPolicyTest {
    @Test void projectStateIsReadDirectlyForEveryBusinessLifecycleState() {
        var policy=new ProjectReportStatusPolicy();
        for(var state:ProjectStatus.values()) assertThat(policy.evaluate(state).name()).isEqualTo(state.name());
    }
    @Test void backlogShowsCountsIncludingUnlinkedWorkAndEmptyBacklogIsZeroItems() {
        var rows=java.util.Arrays.stream(SprintBacklogStatus.values()).map(state->{
            var item=new SprintBacklog();item.setStatus(state);return item;
        }).toList();
        var counts=ProjectReportQueryRepository.counts(rows);
        assertThat(counts).isEqualTo(new BacklogCounts(1,1,1,1,0));
        assertThat(counts.total()).isEqualTo(4);
        assertThat(ProjectReportQueryRepository.counts(List.of())).isEqualTo(BacklogCounts.empty());
        assertThat(counts.plus(new BacklogCounts(2,0,0,1,0))).isEqualTo(new BacklogCounts(3,1,1,2,0));
    }
    @Test void overdueUsesStrictDeadlineWithoutAPercentageThreshold() {
        var policy=new ProjectReportRiskPolicy();var now=Instant.parse("2026-10-30T12:00:00Z");
        assertThat(policy.evaluate(IN_PROGRESS,now,false,ProjectStatus.ACTIVE,now).overdue()).isFalse();
        assertThat(policy.evaluate(IN_PROGRESS,now.minusSeconds(1),false,ProjectStatus.ACTIVE,now).overdue()).isTrue();
        assertThat(policy.evaluate(PLANNED,now.plusSeconds(1),false,ProjectStatus.ACTIVE,now).overdue()).isFalse();
        assertThat(policy.evaluate(PLANNED,null,false,ProjectStatus.ACTIVE,now).overdue()).isFalse();
    }
    @Test void awaitingGradingAndAcceptedMilestonesAreNotCurrentlyOverdueAndLateHistoryIsSeparate() {
        var policy=new ProjectReportRiskPolicy();var now=Instant.parse("2026-10-30T12:00:00Z");
        assertThat(policy.evaluate(SUBMITTED,now.minusSeconds(1),false,ProjectStatus.ACTIVE,now).overdue()).isFalse();
        assertThat(policy.evaluate(ACCEPTED,now.minusSeconds(1),true,ProjectStatus.ACTIVE,now))
                .isEqualTo(new ProjectReportRiskPolicy.Flags(false,true));
        for(var state:List.of(ProjectStatus.COMPLETED,ProjectStatus.CANCELLED))
            assertThat(policy.evaluate(IN_PROGRESS,now.minusSeconds(1),false,state,now).overdue()).isFalse();
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
