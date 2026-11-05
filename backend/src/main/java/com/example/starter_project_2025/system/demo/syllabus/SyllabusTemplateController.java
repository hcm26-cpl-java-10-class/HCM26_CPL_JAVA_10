package com.example.starter_project_2025.system.demo.syllabus;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/syllabuses/templates")
@RequiredArgsConstructor
public class SyllabusTemplateController {

    private final SyllabusTemplateService service;

    @PostMapping("/copy")
    @PreAuthorize("hasAuthority('SYLLABUS_CREATE') and hasAuthority('SYLLABUS_READ')")
    public SyllabusModels.Detail copy(@RequestBody SyllabusTemplateService.CopyInput input) {
        return service.copy(input);
    }
}
