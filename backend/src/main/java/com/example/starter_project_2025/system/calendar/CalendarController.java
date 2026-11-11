package com.example.starter_project_2025.system.calendar;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.SessionDTO;
import com.example.starter_project_2025.system.demo.session.SessionFilter;
import com.example.starter_project_2025.system.demo.session.SessionService;
import lombok.RequiredArgsConstructor;
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
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/calendar")
public class CalendarController {

    private final SessionService sessionService;

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

    private Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()) {
            Object principal = authentication.getPrincipal();
            if (principal instanceof UserPrincipal userPrincipal && userPrincipal.getUser() != null) {
                return userPrincipal.getUser().getId();
            }
        }
        return null;
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

        SessionFilter filter = new SessionFilter();
        filter.setFromDate(from);
        filter.setToDate(to);
        if (status != null && !status.isBlank()) {
            try {
                filter.setStatus(List.of(Session.SessionStatus.valueOf(status.trim().toUpperCase())));
            } catch (IllegalArgumentException ignored) {
            }
        }
        if (classId != null) {
            filter.setClassId(List.of(classId));
        }
        if (trainerId != null) {
            filter.setTrainerId(List.of(trainerId));
        }
        filter.setTopicId(topicId);
        filter.setLocation(location);

        PageRequest pageable = PageRequest.of(
                page,
                size,
                Sort.by(
                        Sort.Order.asc("startTime"),
                        Sort.Order.asc("id")
                )
        );

        return sessionService.getAll(pageable, null, filter);
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

        Long currentUserId = getCurrentUserId();
        if (currentUserId == null) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "User must be authenticated to view personal schedule"
            );
        }

        SessionFilter filter = new SessionFilter();
        filter.setFromDate(from);
        filter.setToDate(to);
        if (status != null && !status.isBlank()) {
            try {
                filter.setStatus(List.of(Session.SessionStatus.valueOf(status.trim().toUpperCase())));
            } catch (IllegalArgumentException ignored) {
            }
        }
        if (classId != null) {
            filter.setClassId(List.of(classId));
        }
        filter.setTrainerId(List.of(currentUserId));

        PageRequest pageable = PageRequest.of(
                page,
                size,
                Sort.by(
                        Sort.Order.asc("startTime"),
                        Sort.Order.asc("id")
                )
        );

        return sessionService.getAll(pageable, null, filter);
    }
}
