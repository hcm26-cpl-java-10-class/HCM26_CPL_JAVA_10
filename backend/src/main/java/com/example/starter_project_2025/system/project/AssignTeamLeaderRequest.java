package com.example.starter_project_2025.system.project;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record AssignTeamLeaderRequest(@NotNull @Positive Long memberId,
                                      @NotNull Long expectedVersion,
                                      boolean confirmReplacement) {}
