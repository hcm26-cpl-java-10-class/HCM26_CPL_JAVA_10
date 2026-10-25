package com.example.starter_project_2025.system.project;

import java.util.Arrays;

public enum ProjectMemberRole {
    PM,
    BA,
    DEV,
    QA;

    public static boolean isValid(String role) {
        return role != null
                && Arrays.stream(values()).anyMatch(value -> value.name().equals(role));
    }
}
