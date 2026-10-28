package com.example.starter_project_2025.system.calendar;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.Session.SessionStatus;
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
import com.example.starter_project_2025.init.annotation.ResourceMenu;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/calendar")
@ResourceMenu(
        title = "Timetable",
        group = "Training Operations",
        icon = "calendar",
        url = "/calendar/preview",
        order = 4,
        permission = "SESSION_READ"
)
public class CalendarController {

    private final SessionService sessionService;
    private final com.example.starter_project_2025.system.study_session.StudySessionRepository studySessionRepository;

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
            SessionStatus status,

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
        filter.setStartsBefore(to);
        filter.setEndsAfter(from);
        filter.setStatus(status);
        filter.setClassId(classId);
        filter.setTrainerId(trainerId);
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
            SessionStatus status,

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
        filter.setStartsBefore(to);
        filter.setEndsAfter(from);
        filter.setStatus(status);
        filter.setClassId(classId);
        filter.setTrainerId(currentUserId);

        PageRequest pageable = PageRequest.of(
                page,
                size,
                Sort.by(
                        Sort.Order.asc("startTime"),
                        Sort.Order.asc("id")
                )
        );

        Page<SessionDTO> demoPage = sessionService.getAll(pageable, null, filter);
        List<SessionDTO> allSessions = new java.util.ArrayList<>(demoPage.getContent());

        // Include study sessions from the enterprise module
        List<com.example.starter_project_2025.system.study_session.StudySession> studyList =
                studySessionRepository.findPotentialScheduleEntries(from.toLocalDate(), to.toLocalDate());
        for (var s : studyList) {
            if (s.getSessionDate() == null || s.getStartTime() == null || s.getEndTime() == null) continue;
            LocalDateTime sStart = s.getSessionDate().atTime(s.getStartTime());
            LocalDateTime sEnd = s.getSessionDate().atTime(s.getEndTime());
            if (sStart.isAfter(to) || sEnd.isBefore(from)) continue;

            Session.SessionStatus sStatus = Session.SessionStatus.SCHEDULED;
            if (s.getStatus() != null) {
                try {
                    sStatus = Session.SessionStatus.valueOf(s.getStatus().name());
                } catch (Exception ignored) {}
            }
            if (status != null && status != sStatus) continue;

            SessionDTO dto = SessionDTO.builder()
                    .classId(s.getClassId())
                    .topicId(s.getSubjectId())
                    .trainerId(s.getTrainerId())
                    .teachingAssignmentId(s.getTeachingAssignmentId())
                    .roomId(s.getRoomId())
                    .location(s.getRoom() != null ? s.getRoom() : (s.getMeetingUrl() != null ? "Online" : null))
                    .meetingUrl(s.getMeetingUrl())
                    .title(s.getTitle())
                    .startTime(sStart)
                    .endTime(sEnd)
                    .status(sStatus)
                    .note(s.getNotes())
                    .build();
            dto.setId(s.getId());
            allSessions.add(dto);
        }

        allSessions.sort((a, b) -> {
            int cmp = a.getStartTime().compareTo(b.getStartTime());
            if (cmp != 0) return cmp;
            return Long.compare(a.getId() != null ? a.getId() : 0, b.getId() != null ? b.getId() : 0);
        });

        int total = allSessions.size();
        int startIndex = Math.min((int) pageable.getOffset(), total);
        int endIndex = Math.min(startIndex + pageable.getPageSize(), total);
        List<SessionDTO> pagedList = allSessions.subList(startIndex, endIndex);

        return new org.springframework.data.domain.PageImpl<>(pagedList, pageable, total);
    }
}