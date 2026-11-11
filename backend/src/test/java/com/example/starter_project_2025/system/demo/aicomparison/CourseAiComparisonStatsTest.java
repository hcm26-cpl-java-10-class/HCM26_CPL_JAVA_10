package com.example.starter_project_2025.system.demo.aicomparison;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Kiểm tra phần thống kê của AI comparison.
 *
 * <p>Đây là phần QUAN TRỌNG nhất: mọi con số AI nói đều lấy từ đây, nên sai số
 * ở đây = sai số trong báo cáo.
 */
class CourseAiComparisonStatsTest {

    @Test
    void medianOfOddNumberOfValues() {
        assertEquals(30.0, CourseAiComparisonStats.medianOf(List.of(10.0, 30.0, 50.0)));
    }

    @Test
    void medianOfEvenNumberOfValues() {
        assertEquals(25.0, CourseAiComparisonStats.medianOf(List.of(10.0, 20.0, 30.0, 40.0)));
    }

    @Test
    void medianOfEmptyListIsZero() {
        assertEquals(0.0, CourseAiComparisonStats.medianOf(List.of()));
    }

    @Test
    void meanRoundsToTwoDecimals() {
        assertEquals(26.67, CourseAiComparisonStats.mean(List.of(10.0, 20.0, 50.0)));
    }

    @Test
    void higherIsBetterRanksHighestFirst() {
        List<Double> peers = List.of(10.0, 20.0, 30.0, 40.0);

        // Target = 35: chỉ 40 là tốt hơn -> hạng 2.
        assertEquals(2, CourseAiComparisonStats.rank(peers, 35.0, true));
        // Target = 50: không peer nào tốt hơn -> hạng 1.
        assertEquals(1, CourseAiComparisonStats.rank(peers, 50.0, true));
        // Target = 5: cả 4 peer tốt hơn -> hạng 5.
        assertEquals(5, CourseAiComparisonStats.rank(peers, 5.0, true));
    }
    @Test
    void lowerIsBetterRanksLowestFirst() {
        List<Double> peers = List.of(10.0, 20.0, 30.0, 40.0);

        // Drop-off: target = 5 thấp hơn mọi peer -> hạng 1.
        assertEquals(1, CourseAiComparisonStats.rank(peers, 5.0, false));
        // Target = 35: 3 peer thấp hơn -> hạng 4.
        assertEquals(4, CourseAiComparisonStats.rank(peers, 35.0, false));
    }

    @Test
    void percentileIsHigherForBetterTarget() {
        List<Double> peers = List.of(10.0, 20.0, 30.0, 40.0);

        int best = CourseAiComparisonStats.percentile(peers, 50.0, true);
        int worst = CourseAiComparisonStats.percentile(peers, 5.0, true);

        assertTrue(best > worst, "target tốt phải có percentile cao hơn");
        assertEquals(100, best, "target tốt nhất trong 5 khóa -> percentile 100");
        assertEquals(0, worst, "target tệ nhất -> percentile 0");
    }

    @Test
    void percentileForMiddleTargetIsInBetween() {
        List<Double> peers = List.of(10.0, 20.0, 30.0, 40.0);

        // Target 25: chỉ 30 và 40 tốt hơn -> hạng 3 trong 5 -> (5-3)/4 = 50%.
        assertEquals(50, CourseAiComparisonStats.percentile(peers, 25.0, true));
        // Target 35: chỉ 40 tốt hơn -> hạng 2 -> (5-2)/4 = 75%.
        assertEquals(75, CourseAiComparisonStats.percentile(peers, 35.0, true));
    }

    @Test
    void percentileWithoutPeersIsNeutral() {
        assertEquals(50, CourseAiComparisonStats.percentile(List.of(), 42.0, true));
    }

    @Test
    void positionThresholds() {
        assertEquals("ABOVE", CourseAiComparisonStats.position(List.of(100, 80, 70)));
        assertEquals("BELOW", CourseAiComparisonStats.position(List.of(30, 20, 10)));
        assertEquals("AT_PAR", CourseAiComparisonStats.position(List.of(50, 40, 60)));
        assertEquals("AT_PAR", CourseAiComparisonStats.position(List.of()));
    }

    @Test
    void positionUsesAveragePercentileOfModuleMetrics() {
        // Trung bình = 50 -> AT_PAR dù có metric rất tốt lẫn rất kém.
        assertEquals("AT_PAR", CourseAiComparisonStats.position(List.of(100, 0)));
        // Trung bình = 70 -> ABOVE.
        assertEquals("ABOVE", CourseAiComparisonStats.position(List.of(100, 40)));
    }

    @Test
    void betterCountIgnoresNullValues() {
        List<Double> peers = new java.util.ArrayList<>();
        peers.add(10.0);
        peers.add(null);
        peers.add(30.0);

        assertEquals(1, CourseAiComparisonStats.betterCount(peers, 20.0, true));
    }
}
