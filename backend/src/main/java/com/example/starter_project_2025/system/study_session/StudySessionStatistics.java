package com.example.starter_project_2025.system.study_session;

public record StudySessionStatistics(long total, long scheduled, long completed, long cancelled,
                                     double completionRate, double cancellationRate) {
    public static StudySessionStatistics of(long scheduled, long completed, long cancelled) {
        long total = scheduled + completed + cancelled;
        return new StudySessionStatistics(total, scheduled, completed, cancelled,
                percentage(completed, total), percentage(cancelled, total));
    }

    private static double percentage(long count, long total) {
        return total == 0 ? 0 : Math.round(count * 10000.0 / total) / 100.0;
    }
}
