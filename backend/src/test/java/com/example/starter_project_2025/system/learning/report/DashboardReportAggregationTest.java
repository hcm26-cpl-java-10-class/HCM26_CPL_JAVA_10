package com.example.starter_project_2025.system.learning.report;

import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.util.List;
import static com.example.starter_project_2025.system.learning.report.ReportData.*;
import static org.assertj.core.api.Assertions.assertThat;

class DashboardReportAggregationTest {

    @Test
    void deterministicCourseOverviewFixturesMatchExpectedRates() {
        var courses = List.of(
            new Course(1L, "Java Core", LocalDate.of(2026, 11, 1), "COMPLETED", 100, 10, 10),
            new Course(2L, "Spring Boot", LocalDate.of(2026, 11, 2), "COMPLETED", 100, 8, 8),
            new Course(3L, "React", LocalDate.of(2026, 11, 5), "IN_PROGRESS", 45, 9, 20),
            new Course(4L, "Docker", LocalDate.of(2026, 11, 10), "IN_PROGRESS", 25, 2, 8),
            new Course(5L, "Kubernetes", LocalDate.of(2026, 11, 12), "ENROLLED", 0, 0, 10)
        );
        var overview = ReportAggregation.overview(courses, 5);
        assertThat(overview.enrolled()).isEqualTo(5);
        assertThat(overview.completed()).isEqualTo(2);
        assertThat(overview.inProgress()).isEqualTo(2);
        assertThat(overview.notStarted()).isEqualTo(1);
        assertThat(overview.completionRate()).isEqualTo(40.0);
        assertThat(overview.averageProgress()).isEqualTo(54.0);
    }

    @Test
    void deterministicRoadmapAndObjectivesRatesMatchExpectedValues() {
        assertThat(ReportAggregation.rate(1, 4)).isEqualTo(25.0);
        assertThat(ReportAggregation.rate(6, 8)).isEqualTo(75.0);
    }
}
