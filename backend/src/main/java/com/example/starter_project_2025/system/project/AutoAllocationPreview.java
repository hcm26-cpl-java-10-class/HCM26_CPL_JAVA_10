package com.example.starter_project_2025.system.project;

import java.util.List;

public record AutoAllocationPreview(
        Long sessionId, int standardMax, int minMembers, int eligibleCount, String fingerprint,
        List<Team> teams
) {
    public record Team(String teamName, List<Member> members) {
    }

    public record Member(Long memberId, String fullName, String userCode) {
    }
}
