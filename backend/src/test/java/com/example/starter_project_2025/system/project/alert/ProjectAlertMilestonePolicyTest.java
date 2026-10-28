package com.example.starter_project_2025.system.project.alert;

import com.example.starter_project_2025.system.project.milestone.domain.*;
import com.example.starter_project_2025.system.project.sprint_backlog.*;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.*;
import java.util.stream.Stream;
import static org.assertj.core.api.Assertions.assertThat;

class ProjectAlertMilestonePolicyTest {
    private final ProjectAlertMilestonePolicy policy=new ProjectAlertMilestonePolicy();
    private final Instant now=Instant.parse("2026-10-28T03:00:00Z");
    private Milestone milestone(Instant due) {
        return Milestone.create(1L,null,9L,"Release",null,due,true,UUID.randomUUID(),null,
                LatePolicyType.NO_LATE,null,null,UUID.randomUUID(),now);
    }
    private List<SprintBacklog> items(int done,int total) {
        return Stream.concat(Stream.generate(()->SprintBacklog.builder().status(SprintBacklogStatus.DONE).build()).limit(done),
                Stream.generate(()->SprintBacklog.builder().status(SprintBacklogStatus.TODO).build()).limit(total-done)).toList();
    }
    @Test void threeOfFiveAlertsButExactlyFourOfFiveDoesNot() {
        var milestone=milestone(now.plus(Duration.ofHours(24)));
        var progress=policy.evaluate(milestone,items(3,5),now);
        assertThat(progress.done()).isEqualTo(3);assertThat(progress.total()).isEqualTo(5);
        assertThat(progress.percentage()).isEqualByComparingTo("60");assertThat(progress.atRisk()).isTrue();
        assertThat(policy.evaluate(milestone,items(4,5),now).atRisk()).isFalse();
        assertThat(policy.evaluate(milestone,items(5,5),now).atRisk()).isFalse();
    }
    @Test void fortyEightHoursIsInclusiveButDeadlineAndOverdueAreExcluded() {
        assertThat(policy.evaluate(milestone(now.plus(Duration.ofHours(48))),items(3,5),now).atRisk()).isTrue();
        assertThat(policy.evaluate(milestone(now.plus(Duration.ofHours(48)).plusSeconds(1)),items(3,5),now).atRisk()).isFalse();
        assertThat(policy.evaluate(milestone(now),items(3,5),now).atRisk()).isFalse();
        assertThat(policy.evaluate(milestone(now.minusSeconds(1)),items(3,5),now).atRisk()).isFalse();
    }
    @Test void emptyMilestoneHasZeroCompletionAndDeletedMilestoneNeverAlerts() {
        var milestone=milestone(now.plusSeconds(3600));
        assertThat(policy.evaluate(milestone,List.of(),now).percentage()).isEqualByComparingTo("0");
        milestone.softDelete(UUID.randomUUID(),now);
        assertThat(policy.evaluate(milestone,items(0,1),now).atRisk()).isFalse();
    }
    @Test void riskUsesExactRatioRatherThanRoundedPercentage() {
        var progress=policy.evaluate(milestone(now.plusSeconds(3600)),items(79999,100000),now);
        assertThat(progress.percentage()).isEqualByComparingTo("80.00");assertThat(progress.atRisk()).isTrue();
    }
}
