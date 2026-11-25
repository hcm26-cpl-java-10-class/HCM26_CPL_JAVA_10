package com.example.starter_project_2025.system.project.milestone.dto.request;

import com.example.starter_project_2025.system.project.milestone.domain.LatePolicyType;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneStatus;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneLifecycleStatus;

import java.time.LocalDate;
import java.util.List;

public record MilestoneListQuery(
        Long teamId,
        int page,
        int size,
        List<String> sort,
        String search,
        List<MilestoneStatus> status,
        Boolean mandatory,
        List<LatePolicyType> latePolicyType,
        LocalDate deadlineFrom,
        LocalDate deadlineTo,
        List<MilestoneLifecycleStatus> lifecycleStatus
) {
    public MilestoneListQuery(Long teamId, int page, int size, List<String> sort, String search,
                              List<MilestoneStatus> status, Boolean mandatory, List<LatePolicyType> latePolicyType,
                              LocalDate deadlineFrom, LocalDate deadlineTo) {
        this(teamId, page, size, sort, search, status, mandatory, latePolicyType, deadlineFrom, deadlineTo, null);
    }
}
