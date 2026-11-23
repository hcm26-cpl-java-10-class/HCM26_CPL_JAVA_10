package com.example.starter_project_2025.system.training;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.LocalDate;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ClassStatisticsService {
    private final TrainingClassRepository classes;
    private final Clock trainingClassClock;

    public record Statistics(long totalClasses, long inProgress, long upcomingClasses,
                             long completedClasses, LocalDate asOf, LocalDate upcomingThrough, String timezone) {}

    public Statistics get() {
        LocalDate today = LocalDate.now(trainingClassClock);
        // Inclusive: today through today + 30 days; only planning/assigned are eligible.
        var result = classes.statistics(today, today.plusDays(30));
        return new Statistics(result.getTotalClasses(), result.getInProgress(), result.getUpcomingClasses(),
                result.getCompletedClasses(), today, today.plusDays(30), trainingClassClock.getZone().getId());
    }
}
