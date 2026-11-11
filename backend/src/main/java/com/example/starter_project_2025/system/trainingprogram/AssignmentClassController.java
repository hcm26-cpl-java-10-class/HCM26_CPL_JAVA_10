package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/teaching-assignments")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ASSIGNMENT_CREATE') and hasAuthority('CLASS_CREATE') and hasAuthority('CLASS_UPDATE_PROGRAM')")
public class AssignmentClassController {
    private final AssignmentClassCreation creation;
    private final AssignmentProgramCreation newPrograms;

    @GetMapping("/class-subject-options")
    public List<AssignmentProgramCreation.SubjectOption> subjects() { return newPrograms.subjectOptions(); }

    @GetMapping("/class-program-options")
    public List<ClassProgramSubjectsResponse.ProgramSummary> programs() { return creation.programOptions(); }

    @PostMapping("/classes")
    public ResponseEntity<ExternalClassDTO> create(@Valid @RequestBody AssignmentClassCreation.Request request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(creation.create(request));
    }
}
