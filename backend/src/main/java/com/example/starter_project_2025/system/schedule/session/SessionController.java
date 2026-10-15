package com.example.starter_project_2025.system.schedule.session;

import com.example.starter_project_2025.system.schedule.session.dto.SessionResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/sessions")
@Tag(name = "Session")
public class SessionController {

    private final SessionService sessionService;

    @GetMapping("/{sessionId}")
    @Operation(summary = "View session details")
    public ResponseEntity<SessionResponse> getById(@PathVariable Long sessionId) {
        return ResponseEntity.ok(sessionService.getById(sessionId));
    }
}
