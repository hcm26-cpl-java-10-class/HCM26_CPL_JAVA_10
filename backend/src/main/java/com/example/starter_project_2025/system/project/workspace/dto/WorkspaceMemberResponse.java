package com.example.starter_project_2025.system.project;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonInclude(JsonInclude.Include.ALWAYS)
public record WorkspaceMemberResponse(
        String userCode,
        String displayName,
        ProjectRole projectRole,
        ParticipationStatus status) {
}
