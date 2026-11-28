package com.example.starter_project_2025.system.project;

import java.util.List;

public record AutoAllocationConfirmRequest(String fingerprint, List<Team> teams) {
    public record Team(String teamName, List<Long> memberIds) {
    }
}
