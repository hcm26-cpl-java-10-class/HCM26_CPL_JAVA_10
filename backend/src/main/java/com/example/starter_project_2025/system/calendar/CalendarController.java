package com.example.starter_project_2025.system.calendar;

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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import com.example.starter_project_2025.init.annotation.ResourceMenu;

import java.time.Duration;
import java.time.LocalDateTime;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/calendar")
@ResourceMenu(
        title = "Timetable",
        group = "Subjects & Scheduling",
        icon = "calendar",
        url = "/calendar/preview",
        order = 7,
        permission = "SESSION_READ"
)
public class CalendarController {

    private final SessionService sessionService;

    @GetMapping("/sessions")
    public Page<SessionDTO> getSessions(
            @RequestParam("from")
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime from,

            @RequestParam("to")
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime to,

            @RequestParam(value = "status", required = false)
            Session.SessionStatus status,

            @RequestParam(value = "page", defaultValue = "0")
            int page,

            @RequestParam(value = "size", defaultValue = "50")
            int size
    ) {
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

        SessionFilter filter = new SessionFilter();
        filter.setStartsBefore(to);
        filter.setEndsAfter(from);
        filter.setStatus(status);

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