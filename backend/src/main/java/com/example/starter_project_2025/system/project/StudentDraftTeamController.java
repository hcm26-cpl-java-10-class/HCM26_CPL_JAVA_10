package com.example.starter_project_2025.system.project;

import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * US-10: the student (team leader) view of the "assign project template to a
 * DRAFT team" story. A student only sees / edits the DRAFT teams they lead
 * (role {@code PM}); the service re-checks ownership on every write.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/students/me/draft-teams")
public class StudentDraftTeamController {

    private final ProjectTeamTemplateService teamTemplateService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public List<TeamProjectTemplateResponse> getMyDraftTeams(Authentication authentication) {
        return teamTemplateService.getMyDraftTeams(authentication);
    }

    @PutMapping("/{teamId}/project-template")
    @PreAuthorize("isAuthenticated()")
    public TeamProjectTemplateResponse assignProjectTemplate(
            @PathVariable Long teamId,
            @Valid @RequestBody AssignProjectTemplateRequest request,
            Authentication authentication
    ) {
        return teamTemplateService.assignTemplateAsTeamLeader(
                teamId, request.projectTemplateId(), authentication);
    }
}
