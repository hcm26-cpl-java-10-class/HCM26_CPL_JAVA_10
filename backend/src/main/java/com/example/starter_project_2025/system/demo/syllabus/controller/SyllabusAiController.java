package com.example.starter_project_2025.system.demo.syllabus.controller;

import com.example.starter_project_2025.system.demo.syllabus.dto.SyllabusAiModels;
import com.example.starter_project_2025.system.demo.syllabus.service.SyllabusAiService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/syllabuses/templates/ai")
@RequiredArgsConstructor
public class SyllabusAiController {
    private final SyllabusAiService service;

    @GetMapping("/status")
    @PreAuthorize("hasAuthority('SYLLABUS_CREATE')")
    public SyllabusAiModels.Status status() {
        return new SyllabusAiModels.Status(service.isConfigured());
    }

    /** Produces only a reviewable preview. NEVER writes to the database. */
    @PostMapping("/generate")
    @PreAuthorize("hasAuthority('SYLLABUS_CREATE')")
    public SyllabusAiModels.Draft generate(@RequestBody SyllabusAiModels.GenerateRequest input) {
        return service.generate(input);
    }

    /** The reviewed payload is saved as an independent DRAFT in one transaction. */
    @PostMapping("/save")
    @PreAuthorize("hasAuthority('SYLLABUS_CREATE') and hasAuthority('SYLLABUS_UPDATE')")
    public SyllabusAiModels.SaveResult save(@RequestBody SyllabusAiModels.Draft draft) {
        return service.save(draft);
    }
}
