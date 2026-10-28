package com.example.starter_project_2025.system.project.milestone.controller;

import com.example.starter_project_2025.system.project.milestone.domain.LatePolicyType;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneStatus;
import com.example.starter_project_2025.system.project.milestone.dto.request.MilestoneListQuery;
import com.example.starter_project_2025.system.project.milestone.dto.response.MilestonePageResponse;
import com.example.starter_project_2025.system.project.milestone.service.MilestoneQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.access.prepost.PreAuthorize;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/milestones")
@RequiredArgsConstructor
public class AllMilestonesController {
    private final MilestoneQueryService queryService;

    @GetMapping
    @PreAuthorize("hasAuthority('MILESTONE_READ')")
    public MilestonePageResponse getList(
            @RequestParam(required = false) Long teamId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) List<String> sort,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) List<MilestoneStatus> status,
            @RequestParam(required = false) Boolean mandatory,
            @RequestParam(required = false) List<LatePolicyType> latePolicyType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate deadlineFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate deadlineTo
    ) {
        return queryService.getAllList(new MilestoneListQuery(teamId, page, size, sort, search,
                status, mandatory, latePolicyType, deadlineFrom, deadlineTo));
    }
}
