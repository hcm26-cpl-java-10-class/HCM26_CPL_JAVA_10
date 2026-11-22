package com.example.starter_project_2025.system.exam.supervisor.signaling;

import com.example.starter_project_2025.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/exam-supervisor")
@RequiredArgsConstructor
public class ExamSupervisorSignalingTicketController {

    private final ExamSupervisorSignalingTicketService ticketService;

    @PostMapping("/signaling-ticket")
    public TicketResponse createTicket(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody TicketRequest request
    ) {
        return new TicketResponse(
                ticketService.issue(
                        principal,
                        request.attemptId(),
                        request.role()
                )
        );
    }

    public record TicketRequest(Long attemptId, String role) {}

    public record TicketResponse(String ticket) {}
}