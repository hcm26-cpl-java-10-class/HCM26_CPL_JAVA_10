package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.dto.ReminderDTO;
import com.example.starter_project_2025.system.exam.dto.ReminderRequest;
import com.example.starter_project_2025.system.exam.service.ReminderService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Tag(name = "Exam Reminder", description = "APIs for scheduling reminder emails before an exam")
public class ReminderController {

    private final ReminderService service;

    @PostMapping("/exams/{examId}/reminders")
    @PreAuthorize("hasAuthority('INVITATION_CREATE')")
    public ResponseEntity<List<ReminderDTO>> schedule(
            @PathVariable Long examId,
            @Valid @RequestBody ReminderRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(service.scheduleReminder(examId, request, principal));
    }

    @GetMapping("/exams/{examId}/reminders")
    @PreAuthorize("hasAuthority('INVITATION_READ')")
    public ResponseEntity<List<ReminderDTO>> listByExam(
            @PathVariable Long examId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(service.getRemindersByExam(examId, principal));
    }

    @GetMapping("/reminders/{id}")
    @PreAuthorize("hasAuthority('INVITATION_READ')")
    public ResponseEntity<ReminderDTO> getById(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(service.getById(id, principal));
    }

    @DeleteMapping("/reminders/{id}")
    @PreAuthorize("hasAuthority('INVITATION_DELETE')")
    public ResponseEntity<Void> cancel(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        service.cancelReminder(id, principal);
        return ResponseEntity.noContent().build();
    }
}
