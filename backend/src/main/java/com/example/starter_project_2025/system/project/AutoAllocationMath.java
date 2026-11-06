package com.example.starter_project_2025.system.project;

import java.util.ArrayList;
import java.util.List;

public final class AutoAllocationMath {
    private AutoAllocationMath() { }

    public static List<Integer> teamSizes(int memberCount, int standardMax) {
        if (memberCount <= 0 || standardMax <= 0 || standardMax == Integer.MAX_VALUE) {
            throw new IllegalArgumentException("Positive member count and capacity are required");
        }
        int fullGroups = memberCount / standardMax;
        int remainder = memberCount % standardMax;
        List<Integer> sizes = new ArrayList<>(fullGroups + (remainder == 0 ? 0 : 1));
        for (int i = 0; i < fullGroups; i++) sizes.add(standardMax);
        if (remainder > 0) sizes.add(remainder);
        return List.copyOf(sizes);
    }
}
