package com.example.starter_project_2025.system.exam.dashboard;

import java.time.LocalDateTime;
import java.util.List;

/** Everything a teacher has to act on across their exams, on one screen. */
public record ExamDashboardDTO(Summary summary, List<Item> items) {

    public record Summary(long pendingGrading, long flaggedAttempts, long pendingAppeals, long closingSoonInvitations,
                          int examsNeedingAttention, int totalExams) {
    }

    /** One exam that needs attention. Zero counters mean "nothing to do" for that kind of work. */
    public record Item(Long examId, String title, String category, long pendingGrading, long flaggedAttempts,
                       long pendingAppeals, long closingSoonInvitations, LocalDateTime nextClosingAt) {

        public long total() {
            return pendingGrading + flaggedAttempts + pendingAppeals + closingSoonInvitations;
        }
    }
}
