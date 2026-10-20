package com.example.starter_project_2025.system.schedule.detection;

import com.example.starter_project_2025.exception.BadRequestException;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class ConflictDetectionServiceImpl implements ConflictDetectionService {

    private final CalendarVersionRepository calendarVersionRepository;
    private final ConflictDetectionRepository conflictDetectionRepository;
    private final ConflictDetectionMapper conflictDetectionMapper;
    private final boolean legacyCalendarExclusion;

    @Autowired
    public ConflictDetectionServiceImpl(
            CalendarVersionRepository calendarVersionRepository,
            ConflictDetectionRepository conflictDetectionRepository,
            ConflictDetectionMapper conflictDetectionMapper
    ) {
        this.calendarVersionRepository = calendarVersionRepository;
        this.conflictDetectionRepository = conflictDetectionRepository;
        this.conflictDetectionMapper = conflictDetectionMapper;
        this.legacyCalendarExclusion = false;
    }

    /** Keeps the existing unit-test seam while production uses the dedicated read repository. */
    public ConflictDetectionServiceImpl(
            CalendarVersionRepository calendarVersionRepository,
            SessionRepository sessionRepository,
            SessionMapper sessionMapper
    ) {
        this.calendarVersionRepository = calendarVersionRepository;
        this.conflictDetectionRepository = new ConflictDetectionRepository() {
            @Override
            public List<Session> findSessionsInDraft(Long calendarVersionId) {
                return sessionRepository.findByCalendarVersion_IdAndIsActiveTrue(calendarVersionId);
            }

            @Override
            public List<Session> findSessionsInActiveVersionsOfOtherClasses(Long excludedCalendarId) {
                return sessionRepository.findActiveSessionsFromOtherCalendars(excludedCalendarId);
            }
        };
        this.conflictDetectionMapper = (session, conflictingSession, conflictTypes) -> ConflictDTO.builder()
                .session(sessionMapper.toResponse(session))
                .conflictingSession(sessionMapper.toResponse(conflictingSession))
                .conflictTypes(conflictTypes)
                .build();
        this.legacyCalendarExclusion = true;
    }

    @Override
    @Transactional(readOnly = true)
    public ConflictCheckResult checkConflicts(Long calendarVersionId) {
        CalendarVersion draftVersion = requireDraftVersion(calendarVersionId);

        List<Session> draftSessions = conflictDetectionRepository.findSessionsInDraft(calendarVersionId);
        Long exclusionId = legacyCalendarExclusion
                ? draftVersion.getCalendar().getId()
                : draftVersion.getCalendar().getClassId();
        List<Session> activeSessions = conflictDetectionRepository
                .findSessionsInActiveVersionsOfOtherClasses(exclusionId);

        Map<String, List<String>> validationErrors = new LinkedHashMap<>();
        List<Session> validDraftSessions = validSessions(draftSessions, validationErrors);
        List<Session> validActiveSessions = validSessions(activeSessions, validationErrors);
        List<ConflictDTO> conflicts = new ArrayList<>();

        detectWithinDraft(validDraftSessions, conflicts);
        detectAgainstOtherActiveClasses(validDraftSessions, validActiveSessions, conflicts);

        boolean hasConflict = !conflicts.isEmpty();
        return ConflictCheckResult.builder()
                .calendarVersionId(calendarVersionId)
                .hasConflict(hasConflict)
                .hasBlockingConflict(hasConflict)
                .canActivate(!hasConflict && validationErrors.isEmpty())
                .conflictCount(conflicts.size())
                .blockingConflictCount(conflicts.size())
                .conflicts(conflicts)
                .validationErrors(validationErrors)
                .build();
    }

    private CalendarVersion requireDraftVersion(Long calendarVersionId) {
        if (calendarVersionId == null || calendarVersionId <= 0) {
            throw new BadRequestException("Calendar version ID must be positive.");
        }

        CalendarVersion version = calendarVersionRepository.findById(calendarVersionId)
                .filter(value -> Boolean.TRUE.equals(value.getIsActive()))
                .filter(value -> value.getCalendar() != null)
                .filter(value -> Boolean.TRUE.equals(value.getCalendar().getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException("Calendar version not found."));

        if (version.getStatus() != CalendarVersionStatus.DRAFT) {
            throw new ConflictException("Conflicts can only be checked for a DRAFT calendar version.");
        }
        if (version.getCalendar().getClassId() == null) {
            throw new BadRequestException("The calendar version is not associated with a valid class.");
        }
        return version;
    }

    private List<Session> validSessions(
            List<Session> sessions,
            Map<String, List<String>> validationErrors
    ) {
        List<Session> validSessions = new ArrayList<>();
        for (Session session : sessions) {
            if (hasValidTimeRange(session)) {
                validSessions.add(session);
                continue;
            }

            String sessionKey = session == null || session.getId() == null
                    ? "sessions.unknown.time"
                    : "sessions." + session.getId() + ".time";
            validationErrors.computeIfAbsent(sessionKey, ignored -> new ArrayList<>())
                    .add("Session start time and end time are required, and end time must be after start time.");
        }
        return validSessions;
    }

    private boolean hasValidTimeRange(Session session) {
        return session != null
                && session.getStartTime() != null
                && session.getEndTime() != null
                && session.getEndTime().isAfter(session.getStartTime());
    }

    private void detectWithinDraft(List<Session> draftSessions, List<ConflictDTO> conflicts) {
        for (int firstIndex = 0; firstIndex < draftSessions.size(); firstIndex++) {
            for (int secondIndex = firstIndex + 1; secondIndex < draftSessions.size(); secondIndex++) {
                addConflictIfPresent(draftSessions.get(firstIndex), draftSessions.get(secondIndex), conflicts);
            }
        }
    }

    private void detectAgainstOtherActiveClasses(
            List<Session> draftSessions,
            List<Session> activeSessions,
            List<ConflictDTO> conflicts
    ) {
        for (Session draftSession : draftSessions) {
            for (Session activeSession : activeSessions) {
                addConflictIfPresent(draftSession, activeSession, conflicts);
            }
        }
    }

    private void addConflictIfPresent(
            Session session,
            Session conflictingSession,
            List<ConflictDTO> conflicts
    ) {
        EnumSet<ConflictType> conflictTypes = detectTypes(session, conflictingSession);
        if (!conflictTypes.isEmpty()) {
            conflicts.add(conflictDetectionMapper.toDto(session, conflictingSession, conflictTypes));
        }
    }

    private EnumSet<ConflictType> detectTypes(Session first, Session second) {
        EnumSet<ConflictType> types = EnumSet.noneOf(ConflictType.class);
        if (!overlaps(first, second)) {
            return types;
        }
        if (first.getTrainerId() != null
                && Objects.equals(first.getTrainerId(), second.getTrainerId())) {
            types.add(ConflictType.TRAINER_CONFLICT);
        }
        if (sameNonBlankRoom(first.getRoom(), second.getRoom())) {
            types.add(ConflictType.ROOM_CONFLICT);
        }
        return types;
    }

    private boolean overlaps(Session first, Session second) {
        return first.getStartTime().isBefore(second.getEndTime())
                && first.getEndTime().isAfter(second.getStartTime());
    }

    private boolean sameNonBlankRoom(String firstRoom, String secondRoom) {
        return firstRoom != null
                && secondRoom != null
                && !firstRoom.isBlank()
                && !secondRoom.isBlank()
                && firstRoom.trim().equalsIgnoreCase(secondRoom.trim());
    }
}
