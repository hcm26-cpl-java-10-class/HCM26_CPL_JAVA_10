    package com.example.starter_project_2025.system.exam.supervisor.signaling;

    import com.example.starter_project_2025.security.UserPrincipal;
    import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttempt;
    import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptRepository;
    import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptStatus;
    import lombok.RequiredArgsConstructor;
    import org.springframework.security.access.AccessDeniedException;
    import org.springframework.stereotype.Service;
    import org.springframework.transaction.annotation.Transactional;

    import java.time.Instant;
    import java.util.Optional;
    import java.util.UUID;
    import java.util.concurrent.ConcurrentHashMap;

    @Service
    @RequiredArgsConstructor
    public class ExamSupervisorSignalingTicketService {

        private static final long TICKET_TTL_SECONDS = 30;

        private final ExamAttemptRepository attemptRepository;

        private final ConcurrentHashMap<String, SignalingTicket> tickets =
                new ConcurrentHashMap<>();

        @Transactional(readOnly = true)
        public String issue(
                UserPrincipal principal,
                Long attemptId,
                String requestedRole
        ) {
            if (principal == null || principal.getUser() == null || attemptId == null) {
                throw new AccessDeniedException(
                        "Not authorized for exam supervision signaling"
                );
            }

            ExamAttempt attempt = attemptRepository.findById(attemptId)
                    .orElseThrow(() ->
                            new AccessDeniedException("Attempt not found")
                    );

            if (attempt.getStatus() != ExamAttemptStatus.IN_PROGRESS) {
                throw new AccessDeniedException("Attempt is not active");
            }

            String role = requestedRole == null
                    ? ""
                    : requestedRole.toUpperCase();

            Long userId = principal.getUser().getId();

            boolean admin = principal.getAuthorities().stream()
                    .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));

            boolean teacher = principal.getAuthorities().stream()
                    .anyMatch(a -> "ROLE_TEACHER".equals(a.getAuthority()));

            if ("STUDENT".equals(role)) {

                if (!attempt.getStudent().getId().equals(userId)) {
                    throw new AccessDeniedException(
                            "Student does not own this attempt"
                    );
                }

            } else if ("SUPERVISOR".equals(role)) {

                if (!admin) {

                    Long instructorId =
                            attempt.getExam().getCourse() == null
                                    || attempt.getExam().getCourse().getInstructorUser() == null
                                    ? null
                                    : attempt.getExam().getCourse()
                                    .getInstructorUser().getId();

                    if (!teacher || !userId.equals(instructorId)) {
                        throw new AccessDeniedException(
                                "Not authorized to supervise this attempt"
                        );
                    }
                }

            } else {
                throw new AccessDeniedException("Invalid signaling role");
            }

            tickets.entrySet().removeIf(
                    entry -> entry.getValue().expiresAt().isBefore(Instant.now())
            );

            String token = UUID.randomUUID().toString();

            tickets.put(
                    token,
                    new SignalingTicket(
                            attemptId,
                            role,
                            userId,
                            Instant.now().plusSeconds(TICKET_TTL_SECONDS)
                    )
            );

            return token;
        }

        public Optional<SignalingTicket> consume(String token) {
            if (token == null || token.isBlank()) {
                return Optional.empty();
            }

            SignalingTicket ticket = tickets.remove(token);

            if (ticket == null || ticket.expiresAt().isBefore(Instant.now())) {
                return Optional.empty();
            }

            return Optional.of(ticket);
        }

        public record SignalingTicket(
                Long attemptId,
                String role,
                Long userId,
                Instant expiresAt
        ) {}
    }