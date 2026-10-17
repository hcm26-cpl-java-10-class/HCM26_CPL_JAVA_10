package com.example.starter_project_2025.system.schedule.session;

import com.example.starter_project_2025.system.schedule.session.dto.SessionResponse;
import com.example.starter_project_2025.system.schedule.session.dto.CreateSessionRequest;
import jakarta.validation.Valid;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1")
@Tag(name = "Session")
public class SessionController {

    private final SessionService sessionService;

    @GetMapping("/sessions/{sessionId}")
    public ResponseEntity<SessionResponse> getById(@PathVariable Long sessionId) {
        return ResponseEntity.ok(sessionService.getById(sessionId));
    }

    @PostMapping("/calendar-versions/{calendarVersionId}/sessions")
    public ResponseEntity<SessionResponse> create(
            @PathVariable Long calendarVersionId, @Valid @RequestBody CreateSessionRequest request) {
        SessionResponse response = sessionService.create(calendarVersionId, request);
        return ResponseEntity.created(URI.create("/api/v1/sessions/" + response.getId())).body(response);
    }
}
