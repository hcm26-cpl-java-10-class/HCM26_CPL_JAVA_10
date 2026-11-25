package com.example.starter_project_2025.system.project;

import lombok.Getter;

@Getter
public class TeamCapacityExceededException extends RuntimeException {

    private final Integer maxMembers;

    public TeamCapacityExceededException(Integer maxMembers) {
        super("Số lượng học viên vượt quá sức chứa tối đa của nhóm (Tối đa: "
                + maxMembers + ")");
        this.maxMembers = maxMembers;
    }
}