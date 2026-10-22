package com.example.starter_project_2025.system.rbac.permission;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class PermissionMatrixItemDTO {
    private Long id;
    private String name;
    private String description;
    private String resource;
    private String action;
}
