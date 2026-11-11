package com.example.starter_project_2025.system.project;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Collections;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class AutoAllocationMathTest {
    @Test
    void acceptanceCasesSplitEvenlyWithinTheWindow() {
        assertEquals(List.of(5, 5, 5, 5, 5, 5), sizes(30, 1, 5));
        assertEquals(List.of(5, 5, 4, 4, 4), sizes(22, 1, 5));
        assertEquals(List.of(5, 5, 5, 4), sizes(19, 1, 5));
        assertEquals(List.of(3, 3), sizes(6, 1, 5));
        assertEquals(List.of(4, 3), sizes(7, 1, 5));
        assertEquals(List.of(3), sizes(3, 1, 5));
        assertEquals(List.of(5, 4), sizes(9, 4, 5));
    }

    @Test
    void boundaryCountsAroundTheWindow() {
        assertEquals(List.of(4), sizes(4, 4, 6));      // exactly min
        assertEquals(List.of(6), sizes(6, 4, 6));      // exactly max
        assertEquals(List.of(4, 3), sizes(7, 3, 6));   // max + 1 splits evenly
        assertEquals(List.of(1), sizes(1, 1, 1));
        assertEquals(Collections.nCopies(7, 1), sizes(7, 1, 1));
    }

    @Test
    void returnsEmptyWhenNoSplitFitsTheWindow() {
        assertEquals(Optional.empty(), AutoAllocationMath.teamSizes(6, 4, 5));  // 1 team > 5, 2 teams < 4
        assertEquals(Optional.empty(), AutoAllocationMath.teamSizes(7, 4, 5));
        assertEquals(Optional.empty(), AutoAllocationMath.teamSizes(3, 4, 6));  // fewer than min
        assertEquals(Optional.empty(), AutoAllocationMath.teamSizes(11, 6, 10));
    }

    @Test
    void rejectsInvalidArguments() {
        assertThrows(IllegalArgumentException.class, () -> AutoAllocationMath.teamSizes(0, 1, 5));
        assertThrows(IllegalArgumentException.class, () -> AutoAllocationMath.teamSizes(5, 0, 5));
        assertThrows(IllegalArgumentException.class, () -> AutoAllocationMath.teamSizes(5, 4, 3));
        assertThrows(IllegalArgumentException.class,
                () -> AutoAllocationMath.teamSizes(5, 1, Integer.MAX_VALUE));
    }

    @Test
    void everySplitIsMinimalBalancedAndWithinTheWindow() {
        for (int max = 1; max <= 12; max++) {
            for (int min = 1; min <= max; min++) {
                for (int count = 1; count <= 150; count++) {
                    Optional<List<Integer>> result = AutoAllocationMath.teamSizes(count, min, max);
                    boolean feasible = existsSplit(count, min, max);
                    assertEquals(feasible, result.isPresent(),
                            "feasibility count=" + count + " window=" + min + "-" + max);
                    if (!feasible) continue;
                    List<Integer> sizes = result.get();
                    int lower = min;
                    int upper = max;
                    assertEquals(count, sizes.stream().mapToInt(Integer::intValue).sum());
                    assertEquals(Math.ceilDiv(count, max), sizes.size());
                    assertTrue(sizes.stream().allMatch(size -> size >= lower && size <= upper));
                    assertTrue(Collections.max(sizes) - Collections.min(sizes) <= 1);
                    for (int i = 1; i < sizes.size(); i++) assertTrue(sizes.get(i - 1) >= sizes.get(i));
                }
            }
        }
    }

    /** Brute force: some team count k satisfies k*min <= count <= k*max. */
    private static boolean existsSplit(int count, int min, int max) {
        for (int k = 1; k <= count; k++) {
            if ((long) k * min <= count && count <= (long) k * max) return true;
        }
        return false;
    }

    private static List<Integer> sizes(int count, int min, int max) {
        return AutoAllocationMath.teamSizes(count, min, max).orElseThrow();
    }
}
