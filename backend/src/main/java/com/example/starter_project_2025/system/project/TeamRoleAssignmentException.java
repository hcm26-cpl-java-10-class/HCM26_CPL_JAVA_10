package com.example.starter_project_2025.system.project;

import java.util.List;
import lombok.Getter;

@Getter
public class TeamRoleAssignmentException extends RuntimeException {

    private final List<Long> invalidMemberIds;

    public TeamRoleAssignmentException(String message, List<Long> invalidMemberIds) {
        super(message);
        this.invalidMemberIds = List.copyOf(invalidMemberIds);
    }
}
