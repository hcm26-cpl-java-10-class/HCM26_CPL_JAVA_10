package com.example.starter_project_2025.system.project;

import lombok.Getter;

/**
 * US-10: a project template can only be assigned while the team is still in
 * {@link ProjectTeamStatus#DRAFT}.
 */
@Getter
public class TeamNotDraftException extends RuntimeException {

    private final Long teamId;
    private final ProjectTeamStatus teamStatus;

    public TeamNotDraftException(Long teamId, ProjectTeamStatus teamStatus) {
        super("Chỉ có thể gán đề bài cho nhóm đang ở trạng thái DRAFT (nhóm hiện tại: "
                + teamStatus + ").");
        this.teamId = teamId;
        this.teamStatus = teamStatus;
    }
}
