package com.example.starter_project_2025.system.project;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/team-member-history")
public class ProjectTeamMemberHistoryController {

    private final ProjectTeamMemberHistoryService historyService;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('PEO_TEAM_ALLOCATE', 'PRJ_WORKSPACE_MANAGE')")
    public ProjectTeamMemberHistoryPageResponse getHistory(
            @RequestParam(required = false) Long classId,
            @RequestParam(required = false) Long cohortId,
            @RequestParam(required = false) Long memberId,
            @RequestParam(required = false) Long teamId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            Authentication authentication
    ) {
        return historyService.getHistory(
                classId, cohortId, memberId, teamId, page, size, authentication);
    }
}
