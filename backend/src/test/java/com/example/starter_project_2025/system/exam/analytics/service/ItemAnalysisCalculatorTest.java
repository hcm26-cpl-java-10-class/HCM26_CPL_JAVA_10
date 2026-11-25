package com.example.starter_project_2025.system.exam.analytics.service;

import com.example.starter_project_2025.system.exam.analytics.dto.ExamItemAnalysisDTO.ItemDTO;
import com.example.starter_project_2025.system.exam.analytics.service.ItemAnalysisCalculator.AttemptResponses;
import com.example.starter_project_2025.system.exam.analytics.service.ItemAnalysisCalculator.ItemResponse;
import com.example.starter_project_2025.system.exam.analytics.service.ItemAnalysisCalculator.OptionInfo;
import com.example.starter_project_2025.system.exam.analytics.service.ItemAnalysisCalculator.TestInfo;
import com.example.starter_project_2025.system.question.core.domain.QuestionType;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class ItemAnalysisCalculatorTest {

    private static ItemResponse mc(long q, Double ratio, Set<Long> selected, boolean answered) {
        return new ItemResponse(q, "Q" + q, QuestionType.MULTIPLE_CHOICE, 1,
                List.of(new OptionInfo(1, "A", true), new OptionInfo(2, "B", false)),
                selected, answered, ratio, null, null);
    }

    private static ItemResponse code(long q, Double ratio, List<String> statuses) {
        return new ItemResponse(q, "C" + q, QuestionType.CODING, 1, List.of(), Set.of(), true, ratio,
                List.of(new TestInfo(true, List.of("1"), "1"), new TestInfo(false, List.of("2"), "2")), statuses);
    }

    /** n bai: bai i dung cau 1 neu i < correctCount; 2 cau nen diem tong tuong quan voi cau 1. */
    private static List<AttemptResponses> cohort(int n, int correctCount) {
        List<AttemptResponses> list = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            boolean right = i < correctCount;
            list.add(new AttemptResponses(i + 1, List.of(
                    mc(1, right ? 1.0 : 0.0, Set.of(right ? 1L : 2L), true),
                    mc(2, i % 2 == 0 ? 1.0 : 0.0, Set.of(i % 2 == 0 ? 1L : 2L), true))));
        }
        return list;
    }

    @Test
    void levelBoundaries() {
        assertNull(ItemAnalysisCalculator.difficultyLevel(null));
        assertEquals("EASY", ItemAnalysisCalculator.difficultyLevel(0.8));
        assertEquals("MEDIUM", ItemAnalysisCalculator.difficultyLevel(0.3));
        assertEquals("HARD", ItemAnalysisCalculator.difficultyLevel(0.29));
        assertNull(ItemAnalysisCalculator.discriminationLevel(null));
        assertEquals("GOOD", ItemAnalysisCalculator.discriminationLevel(0.3));
        assertEquals("FAIR", ItemAnalysisCalculator.discriminationLevel(0.2));
        assertEquals("POOR", ItemAnalysisCalculator.discriminationLevel(0.0));
        assertEquals("NEGATIVE", ItemAnalysisCalculator.discriminationLevel(-0.01));
    }

    @Test
    void roundKeepsFourDecimals() {
        assertEquals(0.3333, ItemAnalysisCalculator.round(1.0 / 3));
    }

    @Test
    void tooFewAttemptsHasNoDiscrimination() {
        assertEquals("TOO_FEW_ATTEMPTS", ItemAnalysisCalculator.discriminationProblem(cohort(5, 3)));
        for (ItemDTO item : ItemAnalysisCalculator.analyze(cohort(5, 3))) {
            assertNull(item.discrimination());
        }
    }

    @Test
    void identicalScoresAreFlaggedTooClose() {
        Map<Long, Double> raw = new java.util.LinkedHashMap<>();
        for (long i = 1; i <= 12; i++) {
            raw.put(i, 0.5);
        }
        assertEquals("SCORES_TOO_CLOSE", ItemAnalysisCalculator.discriminationProblem(raw));
    }

    @Test
    void spreadScoresAreReliable() {
        Map<Long, Double> raw = new java.util.LinkedHashMap<>();
        for (long i = 1; i <= 12; i++) {
            raw.put(i, i / 12.0);
        }
        assertNull(ItemAnalysisCalculator.discriminationProblem(raw));
    }

    @Test
    void emptyInputGivesNoItems() {
        assertTrue(ItemAnalysisCalculator.analyze(List.of()).isEmpty());
    }

    @Test
    void difficultyAndAnswerRates() {
        List<ItemDTO> items = ItemAnalysisCalculator.analyze(cohort(10, 4));
        ItemDTO q1 = items.get(0);
        assertEquals(1, q1.order());
        assertEquals(10, q1.attempts());
        assertEquals(10, q1.answered());
        assertEquals(1.0, q1.answerRate());
        assertEquals(4, q1.fullyCorrect());
        assertEquals(0.4, q1.difficultyIndex());
        assertEquals("MEDIUM", q1.difficultyLevel());
    }

    @Test
    void goodItemDiscriminatesPositively() {
        // cau 1 dung <=> bai thuoc nhom diem cao
        List<AttemptResponses> list = new ArrayList<>();
        for (int i = 1; i <= 20; i++) {
            boolean strong = i > 10;
            List<ItemResponse> items = new ArrayList<>();
            items.add(mc(1, strong ? 1.0 : 0.0, Set.of(strong ? 1L : 2L), true));
            for (int k = 2; k <= 5; k++) {
                items.add(mc(k, strong ? 1.0 : 0.0, Set.of(strong ? 1L : 2L), true));
            }
            list.add(new AttemptResponses(i, items));
        }
        ItemDTO q1 = ItemAnalysisCalculator.analyze(list).get(0);
        assertEquals(1.0, q1.discrimination());
        assertEquals("GOOD", q1.discriminationLevel());
    }

    @Test
    void reverseItemIsFlaggedNegative() {
        List<AttemptResponses> list = new ArrayList<>();
        for (int i = 1; i <= 20; i++) {
            boolean strong = i > 10;
            List<ItemResponse> items = new ArrayList<>();
            items.add(mc(1, strong ? 0.0 : 1.0, Set.of(strong ? 2L : 1L), true));
            for (int k = 2; k <= 5; k++) {
                items.add(mc(k, strong ? 1.0 : 0.0, Set.of(strong ? 1L : 2L), true));
            }
            list.add(new AttemptResponses(i, items));
        }
        ItemDTO q1 = ItemAnalysisCalculator.analyze(list).get(0);
        assertTrue(q1.discrimination() < 0);
        assertTrue(q1.flags().contains("NEGATIVE_DISCRIMINATION"));
    }

    @Test
    void nobodyCorrectFlagNeedsFiveGradedAttempts() {
        assertFalse(ItemAnalysisCalculator.analyze(cohort(4, 0)).get(0).flags().contains("NOBODY_CORRECT"));
        assertTrue(ItemAnalysisCalculator.analyze(cohort(6, 0)).get(0).flags().contains("NOBODY_CORRECT"));
    }

    @Test
    void unusedDistractorIsFlaggedAndOptionCountsAreKept() {
        List<AttemptResponses> list = new ArrayList<>();
        for (int i = 1; i <= 6; i++) {
            list.add(new AttemptResponses(i, List.of(mc(1, 1.0, Set.of(1L), true))));
        }
        ItemDTO q = ItemAnalysisCalculator.analyze(list).get(0);
        assertTrue(q.flags().contains("UNUSED_DISTRACTOR"));
        assertEquals(6, q.options().get(0).selectedCount());
        assertEquals(1.0, q.options().get(0).selectedRate());
        assertEquals(0, q.options().get(1).selectedCount());
    }

    @Test
    void ungradedAnswerDoesNotCountTowardDifficulty() {
        List<AttemptResponses> list = List.of(
                new AttemptResponses(1, List.of(mc(1, null, Set.of(), false))),
                new AttemptResponses(2, List.of(mc(1, 1.0, Set.of(1L), true))));
        ItemDTO q = ItemAnalysisCalculator.analyze(list).get(0);
        assertEquals(2, q.attempts());
        assertEquals(1, q.answered());
        assertEquals(0.5, q.answerRate());
        assertEquals(1.0, q.difficultyIndex());
    }

    @Test
    void itemsAreOrderedByFirstAppearanceInSortedAttempts() {
        List<AttemptResponses> list = List.of(
                new AttemptResponses(2, List.of(mc(5, 1.0, Set.of(1L), true))),
                new AttemptResponses(1, List.of(mc(9, 1.0, Set.of(1L), true))));
        List<ItemDTO> items = ItemAnalysisCalculator.analyze(list);
        assertEquals(9L, items.get(0).sourceQuestionId());
        assertEquals(5L, items.get(1).sourceQuestionId());
    }

    @Test
    void codingStatsCountPerTestAndErrorKinds() {
        List<AttemptResponses> list = List.of(
                new AttemptResponses(1, List.of(code(1, 1.0, List.of("OK", "OK")))),
                new AttemptResponses(2, List.of(code(1, 0.5, List.of("OK", "TIME_LIMIT")))),
                new AttemptResponses(3, List.of(code(1, 0.0, List.of("COMPILE_ERROR", "COMPILE_ERROR")))),
                new AttemptResponses(4, List.of(code(1, 0.0, List.of("NO_CODE", "NO_CODE")))),
                new AttemptResponses(5, List.of(code(1, 0.0, List.of("RUNTIME_ERROR", "OK")))),
                new AttemptResponses(6, List.of(code(1, null, null))));
        var stat = ItemAnalysisCalculator.analyze(list).get(0).code();
        assertNotNull(stat);
        assertEquals(5, stat.graded());
        assertEquals(1, stat.compileErrors());
        assertEquals(1, stat.noCode());
        assertEquals(1, stat.timeouts());
        assertEquals(1, stat.runtimeErrors());
        assertEquals(2, stat.tests().size());
        assertEquals(5, stat.tests().get(0).evaluated());
        assertEquals(2, stat.tests().get(0).passed());
        assertEquals(0.4, stat.tests().get(0).passRate());
        assertEquals(1, stat.tests().get(1).statusCounts().get("TIME_LIMIT"));
    }

    @Test
    void codingStatsHandleNoStoredStatuses() {
        var stat = ItemAnalysisCalculator.analyze(
                List.of(new AttemptResponses(1, List.of(code(1, 1.0, List.of()))))).get(0).code();
        assertEquals(0, stat.graded());
        assertNull(stat.tests().get(0).passRate());
    }
}
