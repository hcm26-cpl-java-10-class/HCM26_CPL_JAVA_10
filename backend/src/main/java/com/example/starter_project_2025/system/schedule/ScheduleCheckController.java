package com.example.starter_project_2025.system.schedule;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/schedule-checks")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('SESSION_READ') and (hasAuthority('SESSION_CREATE') or hasAuthority('SESSION_UPDATE'))")
public class ScheduleCheckController {
    private final ScheduleValidationEngine service;
    private final ScheduleReferenceProvider references;
    private final ScheduleRules rules;

    public record Request(
            @NotEmpty(message = "Provide at least one session to validate.")
            @Size(max = 200, message = "A validation request cannot contain more than 200 sessions.")
            List<@NotNull(message = "Session details are required.") ScheduleCandidate> sessions) {}
    public record Resources(ScheduleReferences references, ScheduleRules rules) {}

    @PostMapping
    public ScheduleValidationResult validate(@Valid @RequestBody Request request) {
        return service.validate(request.sessions());
    }

    @GetMapping("/resources")
    public Resources resources() {
        return new Resources(references.load(), rules);
    }
}
