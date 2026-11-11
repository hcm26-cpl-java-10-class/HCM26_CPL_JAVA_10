package com.example.starter_project_2025.system.demo.analytics;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class DropoutRiskScorerTest {

    private static DropoutRiskScorer.Input input(double progress, long idleDays, Double exam,
                                                 long studySeconds, long expectedSeconds,
                                                 boolean completed, boolean neverStarted) {
        return new DropoutRiskScorer.Input(progress, idleDays, 14, exam, studySeconds, expectedSeconds,
                completed, neverStarted);
    }

    @Test
    void newlyEnrolledLearnerIsNotFlagged() {
        DropoutRiskScorer.Result r = DropoutRiskScorer.score(input(0, 0, null, 0, 0, false, true));

        assertEquals(0, r.score());
        assertEquals("LOW", r.level());
        assertTrue(r.factors().isEmpty());
    }

    @Test
    void lowProgressAloneDoesNotFlagAnActiveLearner() {
        // Đang học đều (2 ngày trước), tiến độ 10%, không có điểm thi.
        DropoutRiskScorer.Result r = DropoutRiskScorer.score(input(10, 2, null, 0, 0, false, false));

        assertEquals(0, r.score());
        assertEquals("LOW", r.level());
    }

    @Test
    void activeLearnerWithWeakExamAndLittleStudyTimeStaysBelowMedium() {
        DropoutRiskScorer.Result r = DropoutRiskScorer.score(input(10, 2, 30.0, 10, 1000, false, false));

        assertEquals(25, r.score(), "15 điểm thi + 10 điểm thời gian học");
        assertEquals("LOW", r.level());
    }

    @Test
    void neverStartedLearnerPastThresholdIsHighRisk() {
        DropoutRiskScorer.Result r = DropoutRiskScorer.score(input(0, 14, null, 0, 0, false, true));

        assertEquals(60, r.score(), "20 không hoạt động + 25 tiến độ + 15 chưa bắt đầu");
        assertEquals("HIGH", r.level());
        assertEquals("LOW_PROGRESS", r.primaryReason());
    }

    @Test
    void longInactivityIsCappedAt100() {
        DropoutRiskScorer.Result r = DropoutRiskScorer.score(input(0, 90, 10.0, 0, 1000, false, true));

        assertTrue(r.score() <= 100);
        assertEquals("HIGH", r.level());
        assertEquals("INACTIVITY", r.primaryReason());
    }

    @Test
    void completedLearnerIsNeverAtRisk() {
        DropoutRiskScorer.Result r = DropoutRiskScorer.score(input(100, 200, 10.0, 0, 1000, true, false));

        assertEquals(0, r.score());
        assertEquals("COMPLETED", r.level());
    }

    @Test
    void levelBoundaries() {
        assertEquals("LOW", DropoutRiskScorer.level(34));
        assertEquals("MEDIUM", DropoutRiskScorer.level(35));
        assertEquals("MEDIUM", DropoutRiskScorer.level(59));
        assertEquals("HIGH", DropoutRiskScorer.level(60));
    }

    @Test
    void expectedStudySecondsScalesWithProgress() {
        assertEquals(0, DropoutRiskScorer.expectedStudySeconds(50, 0));
        assertEquals(500, DropoutRiskScorer.expectedStudySeconds(50, 1000));
        assertEquals(1000, DropoutRiskScorer.expectedStudySeconds(150, 1000), "progress bị chặn ở 100%");
    }
}
