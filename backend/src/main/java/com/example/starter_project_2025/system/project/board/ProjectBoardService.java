package com.example.starter_project_2025.system.project.board;

public interface ProjectBoardService {

    java.util.List<ProjectBoardProjectOption> getAccessibleProjects();

    java.util.List<ProjectBoardSprintOption> getProjectSprints(Long projectId);

    ProjectBoardResponse getBoard(Long projectId, Long sprintId);

    java.util.List<ProjectBoardSprintOption> getTeamSprints(Long teamId);

    ProjectBoardResponse getTeamBoard(Long teamId, Long sprintId);

    ProjectBoardSprintOption createTeamSprint(Long teamId, TeamSprintCreateRequest request);
}
