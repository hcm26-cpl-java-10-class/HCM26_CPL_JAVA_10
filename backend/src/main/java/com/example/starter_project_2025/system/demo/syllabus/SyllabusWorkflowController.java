
package com.example.starter_project_2025.system.demo.syllabus;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/syllabuses")
@RequiredArgsConstructor
public class SyllabusWorkflowController {

    private final SyllabusWorkflowService workflow;

    @GetMapping("/{id}/progress")
    @PreAuthorize("hasAuthority('SYLLABUS_READ')")
    public SyllabusWorkflowService.ProgressView progress(
            @PathVariable Long id
    ) {
        return workflow.progress(id);
    }

    @PostMapping("/{id}/publish")
    @PreAuthorize("hasAuthority('SYLLABUS_UPDATE')")
    public SyllabusWorkflowService.ProgressView publish(
            @PathVariable Long id
    ) {
        return workflow.publish(id);
    }

    @PostMapping("/{id}/return-to-draft")
    @PreAuthorize("hasAuthority('SYLLABUS_UPDATE')")
    public SyllabusWorkflowService.ProgressView returnToDraft(
            @PathVariable Long id
    ) {
        return workflow.returnToDraft(id);
    }
}
