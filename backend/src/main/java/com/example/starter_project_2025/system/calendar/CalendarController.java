package com.example.starter_project_2025.system.calendar;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.SessionDTO;
import com.example.starter_project_2025.system.demo.session.SessionService;
import com.example.starter_project_2025.system.rbac.user.User;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Locale;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/calendar")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Training Calendar", description = "APIs for weekly timetable queries")
public class CalendarController {

    SessionService sessionService;
    CalendarPersonalScopeResolver personalScopeResolver;

    private void validateDateRange(LocalDateTime from, LocalDateTime to, int page, int size) {
        if (!from.isBefore(to)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "from must be before to"
            );
        }

        if (Duration.between(from, to).compareTo(Duration.ofDays(31)) > 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Date range must not exceed 31 days"
            );
        }

        if (page < 0 || size < 1 || size > 200) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "page must be >= 0 and size must be between 1 and 200"
            );
        }
    }

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()) {
            Object principal = authentication.getPrincipal();
            if (principal instanceof UserPrincipal userPrincipal && userPrincipal.getUser() != null) {
                return userPrincipal.getUser();
            }
        }
        return null;
    }

    private static Session.SessionStatus parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return Session.SessionStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    @GetMapping("/sessions")
    public Page<SessionDTO> getSessions(
            @RequestParam("from")
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime from,

            @RequestParam("to")
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime to,

            @RequestParam(value = "status", required = false)
            String status,

            @RequestParam(value = "classId", required = false)
            Long classId,

            @RequestParam(value = "trainerId", required = false)
            Long trainerId,

            @RequestParam(value = "topicId", required = false)
            Long topicId,

            @RequestParam(value = "location", required = false)
            String location,

            @RequestParam(value = "page", defaultValue = "0")
            int page,

            @RequestParam(value = "size", defaultValue = "50")
            int size
    ) {
        validateDateRange(from, to, page, size);

        return sessionService.getCalendarSessions(
                from,
                to,
                parseStatus(status),
                classId,
                trainerId,
                topicId,
                location,
                null,
                null,
                false,
                sessionPage(page, size)
        );
    }

    @GetMapping("/my-sessions")
    public Page<SessionDTO> getMySessions(
            @RequestParam("from")
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime from,

            @RequestParam("to")
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime to,

            @RequestParam(value = "status", required = false)
            String status,

            @RequestParam(value = "classId", required = false)
            Long classId,

            @RequestParam(value = "page", defaultValue = "0")
            int page,

            @RequestParam(value = "size", defaultValue = "50")
            int size
    ) {
        validateDateRange(from, to, page, size);

        User currentUser = getCurrentUser();
        if (currentUser == null) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "User must be authenticated to view personal schedule"
            );
        }

        CalendarPersonalScopeResolver.PersonalScope scope = personalScopeResolver.resolveFor(currentUser);
        return sessionService.getCalendarSessions(
                from,
                to,
                parseStatus(status),
                classId,
                null,
                null,
                null,
                scope.trainerIds(),
                scope.classIds(),
                true,
                sessionPage(page, size)
        );
    }

    private static PageRequest sessionPage(int page, int size) {
        return PageRequest.of(
                page,
                size,
                Sort.by(
                        Sort.Order.asc("startTime"),
                        Sort.Order.asc("id")
                )
        );
    }
}
