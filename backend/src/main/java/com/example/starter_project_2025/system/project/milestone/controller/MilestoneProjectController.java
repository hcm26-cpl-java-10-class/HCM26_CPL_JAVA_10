package com.example.starter_project_2025.system.project.milestone.controller;

import com.example.starter_project_2025.system.project.milestone.dto.response.MilestoneProjectOptionResponse;
import com.example.starter_project_2025.system.project.milestone.service.MilestoneQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class MilestoneProjectController {

    private final MilestoneQueryService queryService;

    @GetMapping("/milestone-options")
    public ResponseEntity<List<MilestoneProjectOptionResponse>> getProjectOptions() {
        return ResponseEntity.ok(queryService.getProjectOptions());
    }
}

