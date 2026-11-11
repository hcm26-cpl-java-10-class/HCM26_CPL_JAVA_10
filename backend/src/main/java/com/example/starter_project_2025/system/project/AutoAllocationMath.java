package com.example.starter_project_2025.system.project;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class AutoAllocationMath {
    private AutoAllocationMath() { }

    /**
     * Splits {@code memberCount} students into the fewest teams whose sizes all
     * lie in {@code [minMembers, maxMembers]} and differ from each other by at
     * most one (larger teams first).
     *
     * @return the team sizes, or empty when no such split exists
     *         (e.g. 6 students with a 4-5 window).
     */
    public static Optional<List<Integer>> teamSizes(int memberCount, int minMembers, int maxMembers) {
        if (memberCount <= 0 || minMembers <= 0 || maxMembers < minMembers
                || maxMembers == Integer.MAX_VALUE) {
            throw new IllegalArgumentException(
                    "Positive member count and a valid capacity window are required");
        }
        // Fewest teams that keep every team within maxMembers. Using more teams
        // only shrinks the sizes, so if this count cannot reach minMembers no
        // other count can either.
        int groups = Math.ceilDiv(memberCount, maxMembers);
        if ((long) groups * minMembers > memberCount) {
            return Optional.empty();
        }
        int base = memberCount / groups;
        int larger = memberCount % groups;
        List<Integer> sizes = new ArrayList<>(groups);
        for (int i = 0; i < groups; i++) sizes.add(i < larger ? base + 1 : base);
        return Optional.of(List.copyOf(sizes));
    }
}
