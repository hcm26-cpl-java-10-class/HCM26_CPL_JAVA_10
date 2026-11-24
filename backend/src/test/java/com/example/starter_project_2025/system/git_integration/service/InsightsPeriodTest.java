package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.service.InsightsPeriod.Granularity;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class InsightsPeriodTest {
    private static final LocalDate TODAY = LocalDate.parse("2026-11-23"); // a Monday

    private static InsightsPeriod fixed(String range) {
        return InsightsPeriod.resolve(InsightsPeriod.requireValid(range, null, null, TODAY), null, null, TODAY, () -> null);
    }

    @Test
    void fixedRangesEndTodayAndPickTheirGranularity() {
        assertThat(fixed("7d")).extracting(InsightsPeriod::from, InsightsPeriod::granularity)
                .containsExactly(TODAY.minusDays(6), Granularity.DAY);
        assertThat(fixed("30d").granularity()).isEqualTo(Granularity.DAY);
        assertThat(fixed("90d").granularity()).isEqualTo(Granularity.WEEK);
        assertThat(fixed("6m")).extracting(InsightsPeriod::from, InsightsPeriod::granularity)
                .containsExactly(LocalDate.parse("2026-05-24"), Granularity.WEEK);
        assertThat(fixed("1y")).extracting(InsightsPeriod::from, InsightsPeriod::granularity)
                .containsExactly(LocalDate.parse("2025-11-24"), Granularity.MONTH);
        assertThat(fixed(null).range()).isEqualTo(InsightsRange.D30);
    }

    @Test
    void weeksStartOnMondayAndTheEdgeBucketsAreClipped() {
        var period = InsightsPeriod.resolve(InsightsRange.CUSTOM, LocalDate.parse("2026-01-01"), LocalDate.parse("2026-03-04"),
                TODAY, () -> null); // 63 days, Thursday to Wednesday
        assertThat(period.granularity()).isEqualTo(Granularity.WEEK);
        var buckets = period.buckets();
        assertThat(buckets.getFirst()).containsExactly(LocalDate.parse("2026-01-01"), LocalDate.parse("2026-01-04"));
        assertThat(buckets.get(1)).containsExactly(LocalDate.parse("2026-01-05"), LocalDate.parse("2026-01-11"));
        assertThat(buckets.getLast()).containsExactly(LocalDate.parse("2026-03-02"), LocalDate.parse("2026-03-04"));
    }

    @Test
    void monthsAreCalendarMonthsClippedToThePeriod() {
        var buckets = fixed("1y").buckets();
        assertThat(buckets).hasSize(13);
        assertThat(buckets.getFirst()).containsExactly(LocalDate.parse("2025-11-24"), LocalDate.parse("2025-11-30"));
        assertThat(buckets.getLast()).containsExactly(LocalDate.parse("2026-11-01"), TODAY);
    }

    @Test
    void allTimeStartsAtTheFirstActivityOrTodayWithoutAny() {
        assertThat(InsightsPeriod.resolve(InsightsRange.ALL, null, null, TODAY, () -> LocalDate.parse("2023-02-10")).from())
                .isEqualTo(LocalDate.parse("2023-02-10"));
        var empty = InsightsPeriod.resolve(InsightsRange.ALL, null, null, TODAY, () -> null);
        assertThat(empty.from()).isEqualTo(TODAY);
        assertThat(empty.buckets()).hasSize(1);
    }

    @Test
    void invalidRequestsAreRejected() {
        assertThatThrownBy(() -> InsightsPeriod.requireValid("2y", null, null, TODAY)).isInstanceOf(GitIntegrationException.class);
        assertThatThrownBy(() -> InsightsPeriod.requireValid("custom", TODAY, null, TODAY)).isInstanceOf(GitIntegrationException.class);
        assertThatThrownBy(() -> InsightsPeriod.requireValid("custom", TODAY, TODAY.minusDays(1), TODAY)).isInstanceOf(GitIntegrationException.class);
        assertThatThrownBy(() -> InsightsPeriod.requireValid("custom", TODAY, TODAY.plusDays(1), TODAY)).isInstanceOf(GitIntegrationException.class);
        assertThatThrownBy(() -> InsightsPeriod.requireValid("7d", TODAY, null, TODAY)).isInstanceOf(GitIntegrationException.class);
        assertThat(InsightsPeriod.requireValid("custom", TODAY, TODAY, TODAY)).isEqualTo(InsightsRange.CUSTOM);
    }
}
