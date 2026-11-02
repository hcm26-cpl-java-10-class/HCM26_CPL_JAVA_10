package com.example.starter_project_2025.system.project;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;

class AutoAllocationMathTest {
    @Test
    void acceptanceCases() {
        assertEquals(List.of(5, 5, 5, 5, 5, 5), AutoAllocationMath.teamSizes(30, 5));
        assertEquals(List.of(6, 6, 5, 5), AutoAllocationMath.teamSizes(22, 5));
        assertEquals(List.of(5, 5, 5, 4), AutoAllocationMath.teamSizes(19, 5));
    }

    @Test
    void everyPositiveRemainderIsBalancedAndWithinOneExtraSeat() {
        for (int max = 1; max <= 20; max++) {
            for (int count = 1; count <= 200; count++) {
                List<Integer> sizes = AutoAllocationMath.teamSizes(count, max);
                int limit = max + 1;
                assertEquals(count, sizes.stream().mapToInt(Integer::intValue).sum());
                assertTrue(sizes.stream().allMatch(size -> size > 0 && size <= limit));
                assertTrue(sizes.get(0) - sizes.get(sizes.size() - 1) <= 1);
            }
        }
    }
}
