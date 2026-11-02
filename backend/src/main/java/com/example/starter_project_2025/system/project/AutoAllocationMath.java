package com.example.starter_project_2025.system.project;

import java.util.List;
import java.util.stream.IntStream;

public final class AutoAllocationMath {
    private AutoAllocationMath() { }

    public static List<Integer> teamSizes(int memberCount, int standardMax) {
        if (memberCount <= 0 || standardMax <= 0 || standardMax == Integer.MAX_VALUE) {
            throw new IllegalArgumentException("Positive member count and capacity are required");
        }
        int groups = Math.max(1, Math.max(memberCount / standardMax,
                (int) ((memberCount + (long) standardMax) / (standardMax + 1L))));
        int base = memberCount / groups;
        int extra = memberCount % groups;
        return IntStream.range(0, groups).mapToObj(i -> base + (i < extra ? 1 : 0)).toList();
    }
}
