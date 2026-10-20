package com.example.starter_project_2025.system.schedule.detection;

import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarVersionRepository;
import com.example.starter_project_2025.system.schedule.detection.dto.ConflictCheckResult;
import com.example.starter_project_2025.system.schedule.detection.dto.ConflictDTO;
import com.example.starter_project_2025.system.schedule.session.Session;
import com.example.starter_project_2025.system.schedule.session.SessionMapper;
import com.example.starter_project_2025.system.schedule.session.SessionRepository;
import com.example.starter_project_2025.system.schedule.session.SessionStatus;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ConflictDetectionServiceImpl implements ConflictDetectionService {

    CalendarVersionRepository calendarVersionRepository;
    SessionRepository sessionRepository;
    SessionMapper sessionMapper;

    @Override
    @Transactional(readOnly = true)
    public ConflictCheckResult checkConflicts(Long calendarVersionId) {
        if (calendarVersionId == null) {
            throw new IllegalArgumentException("Calendar version ID is required");
        }

        // 1. Validate that the requested calendar version exists and is DRAFT
        CalendarVersion targetVersion = calendarVersionRepository.findById(calendarVersionId)
                .orElseThrow(() -> new ResourceNotFoundException("Calendar Version not found: " + calendarVersionId));

        if (!Boolean.TRUE.equals(targetVersion.getIsActive())) {
            throw new ResourceNotFoundException("Calendar Version not found or inactive: " + calendarVersionId);
        }

        if (targetVersion.getStatus() != CalendarVersionStatus.DRAFT) {
            throw new ConflictException("Only DRAFT calendar versions can be checked for conflicts. Version #"
                    + targetVersion.getVersionNumber() + " is currently " + targetVersion.getStatus());
        }

        List<ConflictDTO> conflicts = new ArrayList<>();
        Map<String, List<String>> validationErrors = new LinkedHashMap<>();

        // 2. Load all sessions of the DRAFT and validate their time ranges
        List<Session> draftSessions = sessionRepository.findByCalendarVersion_IdAndIsActiveTrue(calendarVersionId);
        List<Session> validDraftSessions = new ArrayList<>();

        for (Session session : draftSessions) {
            if (session.getStatus() == SessionStatus.CANCELLED) {
                continue;
            }

            boolean hasError = false;
            if (session.getStartTime() == null || session.getEndTime() == null || !session.getEndTime().isAfter(session.getStartTime())) {
                validationErrors.computeIfAbsent("invalid_time_range", k -> new ArrayList<>())
                        .add("Session ID " + session.getId() + " ('" + session.getTitle() + "') has invalid start or end time.");
                hasError = true;
            }

            if (session.getTrainerId() == null) {
                validationErrors.computeIfAbsent("missing_trainer", k -> new ArrayList<>())
                        .add("Session ID " + session.getId() + " is missing trainer assignment.");
                hasError = true;
            }

            if (!hasError) {
                validDraftSessions.add(session);
            }
        }

        // 3. Check each distinct pair within the DRAFT, without duplicate reversed pairs
        int size = validDraftSessions.size();
        for (int i = 0; i < size; i++) {
            Session s1 = validDraftSessions.get(i);
            for (int j = i + 1; j < size; j++) {
                Session s2 = validDraftSessions.get(j);
                checkSessionOverlap(s1, s2, conflicts);
            }
        }

        // 4. Compare with sessions from ACTIVE calendar versions of other classes only
        Long currentCalendarId = targetVersion.getCalendar() != null ? targetVersion.getCalendar().getId() : null;
        List<Session> otherActiveSessions = sessionRepository.findActiveSessionsFromOtherCalendars(currentCalendarId);

        for (Session s1 : validDraftSessions) {
            for (Session sOther : otherActiveSessions) {
                checkSessionOverlap(s1, sOther, conflicts);
            }
        }

        boolean hasConflict = !conflicts.isEmpty() || !validationErrors.isEmpty();

        return ConflictCheckResult.builder()
                .calendarVersionId(calendarVersionId)
                .hasConflict(hasConflict)
                .conflicts(conflicts)
                .validationErrors(validationErrors)
                .build();
    }

    private void checkSessionOverlap(Session s1, Session s2, List<ConflictDTO> conflicts) {
        // Overlap: startA < endB && endA > startB; touching endpoints do not overlap
        if (!s1.getStartTime().isBefore(s2.getEndTime()) || !s1.getEndTime().isAfter(s2.getStartTime())) {
            return;
        }

        Set<ConflictType> types = EnumSet.noneOf(ConflictType.class);

        // Check Trainer conflict
        if (s1.getTrainerId() != null && s1.getTrainerId().equals(s2.getTrainerId())) {
            types.add(ConflictType.TRAINER_CONFLICT);
        }

        // Check Room conflict (excluding blank/empty)
        if (s1.getRoom() != null && !s1.getRoom().trim().isEmpty()
                && s2.getRoom() != null && !s2.getRoom().trim().isEmpty()
                && s1.getRoom().trim().equalsIgnoreCase(s2.getRoom().trim())) {
            types.add(ConflictType.ROOM_CONFLICT);
        }

        if (!types.isEmpty()) {
            conflicts.add(ConflictDTO.builder()
                    .session(sessionMapper.toResponse(s1))
                    .conflictingSession(sessionMapper.toResponse(s2))
                    .conflictTypes(types)
                    .build());
        }
    }
}
