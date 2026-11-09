package com.example.starter_project_2025.system.rbac.location;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum LocationStatus {
    ACTIVE("Active"),
    INACTIVE("Inactive");

    private final String label;
}