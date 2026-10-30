package com.example.starter_project_2025.system.project.workspace.service;

import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceSection;
import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceSectionDtos;

import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Predicate;

@Component @RequiredArgsConstructor
public class WorkspaceSectionPolicy {
    private final WorkspaceAccessService access;

    public WorkspaceSection section(String key) {
        return Arrays.stream(WorkspaceSection.values()).filter(item -> item.getKey().equals(key)).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workspace section was not found"));
    }
    public String readPermission(WorkspaceSection section) {
        return switch (section) {
            case OVERVIEW -> "WORKSPACE_READ";
            case MEMBERS -> "WORKSPACE_MEMBER_READ";
            case MILESTONE -> "MILESTONE_READ";
            case SPRINT, BACKLOG -> "SPRINT_READ";
            case ARTIFACT -> "ARTIFACT_READ";
            case FEEDBACK -> "FEEDBACK_READ";
            case ACTIVITY -> "WORKSPACE_ACTIVITY_READ";
        };
    }
    public boolean canRead(User user, WorkspaceSection section) {
        return section == WorkspaceSection.OVERVIEW ? access.canRead(user)
                : access.permitted(user, readPermission(section));
    }
    public WorkspaceSectionDtos.Access describe(User user, WorkspaceSection section) {
        boolean readable = canRead(user, section);
        Predicate<String> has = permission -> readable && access.permitted(user, permission);
        Map<String, Boolean> actions = new LinkedHashMap<>();
        switch (section) {
            case MEMBERS -> actions.put("manage", has.test("TEAM_UPDATE"));
            case MILESTONE -> {
                actions.put("create", has.test("MILESTONE_WRITE"));
                actions.put("review", has.test("MILESTONE_WRITE"));
            }
            case SPRINT -> {
                actions.put("create", has.test("SPRINT_WRITE"));
                actions.put("createTask", has.test("SPRINT_WRITE") || has.test("TASK_WRITE"));
                actions.put("configureBoard", has.test("SPRINT_WRITE") || has.test("SPRINT_BACKLOG_UPDATE"));
                actions.put("review", has.test("MILESTONE_WRITE"));
            }
            case BACKLOG -> actions.put("createTask", has.test("SPRINT_WRITE") || has.test("TASK_WRITE"));
            case ARTIFACT -> {
                actions.put("create", has.test("ARTIFACT_WRITE"));
                actions.put("submit", has.test("ARTIFACT_SUBMIT"));
                actions.put("review", has.test("ARTIFACT_REVIEW") || has.test("FEEDBACK_WRITE"));
            }
            case FEEDBACK -> actions.put("create", has.test("FEEDBACK_WRITE"));
            default -> { }
        }
        return new WorkspaceSectionDtos.Access(section.getKey(), readable, actions);
    }
    public boolean canSeeDrafts(User user, WorkspaceSection section) {
        return switch (section) {
            case MILESTONE -> access.permitted(user, "MILESTONE_WRITE");
            case FEEDBACK -> access.permitted(user, "FEEDBACK_WRITE") || access.permitted(user, "ARTIFACT_REVIEW");
            default -> true;
        };
    }
}
