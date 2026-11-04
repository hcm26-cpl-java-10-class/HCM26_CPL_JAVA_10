package com.example.starter_project_2025.system.demo.enrollment;

import java.util.List;

public record AuditFilterOptionsDTO(
        List<Option> departments,
        List<Option> courses
) {
    public record Option(Long id, String name) {
    }
}
