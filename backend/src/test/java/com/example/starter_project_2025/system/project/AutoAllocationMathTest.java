package com.example.starter_project_2025.system.project;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;

class AutoAllocationMathTest {
    @Test
    void acceptanceCases() {
        assertEquals(List.of(5, 5, 5, 5, 5, 5), AutoAllocationMath.teamSizes(30, 5));
        assertEquals(List.of(5, 5, 5, 5, 2), AutoAllocationMath.teamSizes(22, 5));
        assertEquals(List.of(5, 5, 5, 4), AutoAllocationMath.teamSizes(19, 5));
        assertEquals(List.of(5, 1), AutoAllocationMath.teamSizes(6, 5));
        assertEquals(List.of(3), AutoAllocationMath.teamSizes(3, 5));
    }

    @Test
    void everyPositiveRemainderGetsItsOwnTeamWithinCapacity() {
        for (int max = 1; max <= 20; max++) {
            for (int count = 1; count <= 200; count++) {
                List<Integer> sizes = AutoAllocationMath.teamSizes(count, max);
                int capacity = max;
                assertEquals(count, sizes.stream().mapToInt(Integer::intValue).sum());
                assertEquals((count + max - 1) / max, sizes.size());
                assertTrue(sizes.stream().allMatch(size -> size > 0 && size <= capacity));
                assertTrue(sizes.subList(0, sizes.size() - 1).stream().allMatch(size -> size == capacity));
                assertEquals(count % max == 0 ? max : count % max, sizes.get(sizes.size() - 1));
            }
        }
    }
}
