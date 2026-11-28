package com.example.starter_project_2025.system.project.alert;

import com.example.starter_project_2025.system.project.sprint.Sprint;
import com.example.starter_project_2025.system.project.sprint.SprintStatus;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

class ProjectAlertBacklogPolicyTest {
    private final ProjectAlertBacklogPolicy policy = new ProjectAlertBacklogPolicy();
    private final Instant now = Instant.parse("2026-10-30T04:00:00Z");
    private final ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");

    private SprintBacklog overdueItem() {
        return SprintBacklog.builder()
                .sprint(Sprint.builder().status(SprintStatus.ACTIVE).build())
                .status(SprintBacklogStatus.TODO)
                .endDate(LocalDateTime.ofInstant(now.minusSeconds(1), zone))
                .build();
    }

    @ParameterizedTest
    @EnumSource(value = SprintStatus.class, names = {"PLANNED", "COMPLETED", "CANCELLED"})
    void nonActiveSprintsAreExcludedEvenWhenTheirScheduledStartHasPassed(SprintStatus status) {
        var item = overdueItem();
        item.getSprint().setStatus(status);
        item.getSprint().setStartDate(LocalDateTime.ofInstant(now.minusSeconds(86400), zone));

        assertThat(policy.eligible(item, now, zone)).isFalse();
    }

    @ParameterizedTest
    @EnumSource(value = SprintBacklogStatus.class, names = "DONE", mode = EnumSource.Mode.EXCLUDE)
    void unfinishedOverdueItemsInActiveSprintsRemainEligible(SprintBacklogStatus status) {
        var item = overdueItem();
        item.setStatus(status);

        assertThat(policy.eligible(item, now, zone)).isTrue();
    }

    @Test
    void productBacklogItemsWithoutSprintKeepTheirDeadlineEligibility() {
        var item = overdueItem();
        item.setSprint(null);

        assertThat(policy.eligible(item, now, zone)).isTrue();
    }

    @Test
    void doneItemsNeverBecomeEligible() {
        var item = overdueItem();
        item.setStatus(SprintBacklogStatus.DONE);

        assertThat(policy.eligible(item, now, zone)).isFalse();
    }

    @Test
    void deadlineMustExistAndBeStrictlyBeforeNow() {
        var item = overdueItem();
        item.setEndDate(null);
        assertThat(policy.eligible(item, now, zone)).isFalse();

        item.setEndDate(LocalDateTime.ofInstant(now, zone));
        assertThat(policy.eligible(item, now, zone)).isFalse();

        item.setEndDate(LocalDateTime.ofInstant(now.plusSeconds(1), zone));
        assertThat(policy.eligible(item, now, zone)).isFalse();
    }

    @Test
    void deadlineUsesTheConfiguredTimeZone() {
        var item = overdueItem();
        item.setEndDate(LocalDateTime.of(2026, 10, 30, 10, 0));

        assertThat(policy.eligible(item, now, zone)).isTrue();
        assertThat(policy.eligible(item, now, ZoneId.of("UTC"))).isFalse();
    }
}
