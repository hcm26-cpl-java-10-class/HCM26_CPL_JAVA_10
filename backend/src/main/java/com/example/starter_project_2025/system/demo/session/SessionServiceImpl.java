package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.base.crud.CrudAction;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SessionServiceImpl
        extends BaseCrudServiceImpl<Session, Long, SessionDTO, SessionFilter>
        implements SessionService {

    /** Matches no real row: identity ids start at 1. Used when nothing has to be excluded from the overlap check. */
    private static final long NO_SESSION = -1L;
    private static final int MAX_REPORTED_CONFLICTS = 5;
    private static final int TITLE_MAX = 150;
    private static final int LOCATION_MAX = 150;
    private static final DateTimeFormatter SLOT_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    SessionMapper sessionMapper;
    SessionRepository sessionRepository;
    SessionContextVerifier contextVerifier;

    @Override
    protected BaseCrudRepository<Session, Long> getRepository() {
        return sessionRepository;
    }

    @Override
    protected BaseCrudMapper<Session, SessionDTO> getMapper() {
        return sessionMapper;
    }

    @Override
    protected String[] searchableFields() {
        // Cho phÃ©p tÃ¬m kiáº¿m nhanh theo tiÃªu Ä‘á» hoáº·c phÃ²ng há»c
        return new String[]{"title", "location"};
    }

    @Override
    protected void beforeCreate(Session session, SessionDTO request, ValidationContext ctx) {
        // 1. Kiá»ƒm tra thá»i gian: end_time pháº£i sau start_time (BR-02, FR-CAL-01)
        validateSessionTime(request.getStartTime(), request.getEndTime(), ctx);
        validateText(request.getTitle(), request.getLocation(), ctx);
        validateTopic(request.getTopicId(), ctx);

        // 2. The class and trainer are only ids here: re-verify them against the master system
        contextVerifier.verifyClass(request.getClassId(), ctx);
        contextVerifier.verifyTrainer(request.getTrainerId(), ctx);
        if (ctx.hasErrors()) {
            return;
        }

        // 3. Class / trainer / room must be free for the whole slot
        String trimmedTitle = session.getTitle().trim();
        String normalizedRoom = normalizeLocation(request.getLocation());
        session.initializeForSchedule(trimmedTitle, normalizedRoom);
        ensureNoScheduleConflict(NO_SESSION, session.getClassId(), session.getTrainerId(),
                session.getLocation(), session.getStartTime(), session.getEndTime());
    }

    @Override
    protected void beforeUpdate(Session session, SessionDTO request, ValidationContext ctx) {
        // KhÃ´ng cho phÃ©p sá»­a náº¿u buá»•i há»c Ä‘Ã£ hoÃ n thÃ nh hoáº·c Ä‘Ã£ bá»‹ há»§y
        if (session.getStatus() == Session.SessionStatus.COMPLETED) {
            ctx.add("status", "Cannot update a completed session");
            return;
        }

        if (session.getStatus() == Session.SessionStatus.CANCELLED) {
            ctx.add("status", "Cannot update a cancelled session");
            return;
        }

        // A session keeps the class and topic it was created for; moving it elsewhere is a duplicate + cancel.
        if (request.getClassId() != null && !request.getClassId().equals(session.getClassId())) {
            ctx.add("classId", "A session cannot be moved to another class; duplicate it into that class instead");
        }
        if (request.getTopicId() != null && !request.getTopicId().equals(session.getTopicId())) {
            ctx.add("topicId", "A session cannot be moved to another topic");
        }
        validateText(request.getTitle(), request.getLocation(), ctx);

        // Láº¥y thá»i gian má»›i (náº¿u request truyá»n lÃªn) hoáº·c giá»¯ nguyÃªn thá»i gian cÅ©
        LocalDateTime newStart = request.getStartTime() != null ? request.getStartTime() : session.getStartTime();
        LocalDateTime newEnd = request.getEndTime() != null ? request.getEndTime() : session.getEndTime();
        Long newTrainerId = request.getTrainerId() != null ? request.getTrainerId() : session.getTrainerId();

        validateSessionTime(newStart, newEnd, ctx);
        if (!Objects.equals(newTrainerId, session.getTrainerId())) {
            contextVerifier.verifyTrainer(newTrainerId, ctx);
        }
        if (ctx.hasErrors()) {
            return;
        }

        String trimmedTitle = null;
        if (request.getTitle() != null) {
            // the mapper copies the request over the entity afterwards, so the trimmed value goes on both
            trimmedTitle = request.getTitle().trim();
            request.setTitle(trimmedTitle);
        }
        String nextLocation = session.getLocation();
        if (request.getLocation() != null) {
            // the mapper ignores nulls, so a cleared room is applied here to keep the check and the row consistent
            nextLocation = normalizeLocation(request.getLocation());
            request.setLocation(nextLocation);
        }
        session.updateScheduleDetails(trimmedTitle, nextLocation);

        ensureNoScheduleConflict(session.getId(), session.getClassId(), newTrainerId,
                session.getLocation(), newStart, newEnd);
    }

    @Override
    public SessionDTO cancelSession(Long id, SessionCancelDTO cancelDTO) {
        checkPermission(CrudAction.UPDATE);

        // Láº¥y session tá»« DB
        Session session = findSession(id);

        // Kiá»ƒm tra Ä‘iá»u kiá»‡n nghiá»‡p vá»¥: KhÃ´ng há»§y buá»•i há»c Ä‘Ã£ hoÃ n thÃ nh
        session.cancel(cancelDTO.cancelReason());

        Session updatedSession = sessionRepository.save(session);
        return sessionMapper.toDto(updatedSession);
    }

    @Override
    public SessionDTO completeSession(Long id) {
        checkPermission(CrudAction.UPDATE);

        Session session = findSession(id);
        session.complete();
        return sessionMapper.toDto(sessionRepository.save(session));
    }

    @Override
    public SessionDTO rescheduleSession(Long id, SessionRescheduleDTO rescheduleDTO) {
        checkPermission(CrudAction.UPDATE);

        Session session = findSession(id);
        session.requireScheduled("rescheduled");

        ValidationContext ctx = new ValidationContext();
        validateSessionTime(rescheduleDTO.startTime(), rescheduleDTO.endTime(), ctx);
        ctx.throwIfErrors();

        String location = rescheduleDTO.location() != null
                ? normalizeLocation(rescheduleDTO.location())
                : session.getLocation();

        // Class, topic and trainer are untouched, so only the slot and the room can collide with something else
        ensureNoScheduleConflict(session.getId(), session.getClassId(), session.getTrainerId(),
                location, rescheduleDTO.startTime(), rescheduleDTO.endTime());

        session.rescheduleTo(rescheduleDTO.startTime(), rescheduleDTO.endTime(), location);
        return sessionMapper.toDto(sessionRepository.save(session));
    }

    @Override
    public SessionDTO duplicateSession(Long id, SessionDuplicateDTO duplicateDTO) {
        checkPermission(CrudAction.CREATE);

        Session source = findSession(id);

        ValidationContext ctx = new ValidationContext();
        validateSessionTime(duplicateDTO.startTime(), duplicateDTO.endTime(), ctx);
        contextVerifier.verifyClass(source.getClassId(), ctx);
        contextVerifier.verifyTrainer(source.getTrainerId(), ctx);
        ctx.throwIfErrors();

        String location = duplicateDTO.location() != null
                ? normalizeLocation(duplicateDTO.location())
                : source.getLocation();

        ensureNoScheduleConflict(NO_SESSION, source.getClassId(), source.getTrainerId(),
                location, duplicateDTO.startTime(), duplicateDTO.endTime());

        // A copy is always a fresh SCHEDULED session: the outcome of the source (completed/cancelled) is not inherited
        Session copy = source.duplicateTo(duplicateDTO.startTime(), duplicateDTO.endTime(), location);

        return sessionMapper.toDto(sessionRepository.save(copy));
    }

    private Session findSession(Long id) {
        return sessionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found with id: " + id));
    }

    /**
     * Rows of a file import are written by the generic importer, which knows nothing about sessions. They are
     * validated here instead, with the same rules as a created session: valid slot and text, a class and trainer
     * that exist in the master system, no schedule conflict. Imported sessions always start as SCHEDULED.
     */
    @Override
    @Transactional(readOnly = true)
    public void validateImportRow(Session session, SessionContextVerifier.Memo memo) {
        ValidationContext ctx = new ValidationContext();
        validateSessionTime(session.getStartTime(), session.getEndTime(), ctx);
        validateText(session.getTitle(), session.getLocation(), ctx);
        validateTopic(session.getTopicId(), ctx);
        contextVerifier.verifyClass(session.getClassId(), ctx, memo);
        contextVerifier.verifyTrainer(session.getTrainerId(), ctx, memo);

        if (ctx.hasErrors()) {
            throw new IllegalArgumentException(ctx.getErrors().entrySet().stream()
                    .map(entry -> entry.getKey() + ": " + String.join(", ", entry.getValue()))
                    .collect(Collectors.joining("; ")));
        }

        session.initializeForSchedule(session.getTitle().trim(), normalizeLocation(session.getLocation()));

        ensureNoScheduleConflict(NO_SESSION, session.getClassId(), session.getTrainerId(),
                session.getLocation(), session.getStartTime(), session.getEndTime());
    }

    /**
     * Validate nghiá»‡p vá»¥ thá»i gian: End Time pháº£i lá»›n hÆ¡n Start Time
     */
    private void validateSessionTime(LocalDateTime start, LocalDateTime end, ValidationContext ctx) {
        if (start == null) {
            ctx.add("startTime", "Start time is required");
        }
        if (end == null) {
            ctx.add("endTime", "End time is required");
        }
        if (start != null && end != null && !end.isAfter(start)) {
            ctx.add("endTime", "End time must be after start time");
        }
    }

    private static String normalizeLocation(String location) {
        if (location == null || location.isBlank()) {
            return null;
        }
        return location.trim();
    }

    /**
     * The size rules on SessionDTO sit in the default validation group, which the create/update endpoints
     * (@Validated(OnCreate/OnUpdate)) never run, so title and room are checked here before reaching the database.
     */
    private static void validateText(String title, String location, ValidationContext ctx) {
        if (title != null) {
            String trimmed = title.trim();
            if (trimmed.isEmpty()) {
                ctx.add("title", "Title is required");
            } else if (trimmed.length() > TITLE_MAX) {
                ctx.add("title", "Title must not exceed " + TITLE_MAX + " characters");
            }
        }
        if (location != null && location.trim().length() > LOCATION_MAX) {
            ctx.add("location", "Location must not exceed " + LOCATION_MAX + " characters");
        }
    }

    private static void validateTopic(Long topicId, ValidationContext ctx) {
        if (topicId != null && topicId <= 0) {
            ctx.add("topicId", "Topic ID must be a positive number");
        }
    }

    /**
     * Rejects the slot when the class, the trainer or the room already has an active (non-cancelled)
     * session overlapping it. Always evaluated on the server, whatever the client checked.
     */
    private void ensureNoScheduleConflict(Long excludeSessionId, Long classId, Long trainerId, String location,
                                          LocalDateTime start, LocalDateTime end) {
        Set<String> conflicts = new LinkedHashSet<>();

        List<Session> sameClassOrTrainer = sessionRepository.findOverlappingForClassOrTrainer(
                start, end, classId, trainerId, excludeSessionId, Session.SessionStatus.CANCELLED);
        for (Session other : sameClassOrTrainer) {
            if (Objects.equals(other.getTrainerId(), trainerId)) {
                conflicts.add("Trainer #" + trainerId + " is already assigned to " + describe(other));
            }
            if (Objects.equals(other.getClassId(), classId)) {
                conflicts.add("Class #" + classId + " already has " + describe(other));
            }
        }

        if (location != null) {
            for (Session other : sessionRepository.findOverlappingAtLocation(
                    start, end, location, excludeSessionId, Session.SessionStatus.CANCELLED)) {
                conflicts.add("Room '" + location + "' is already used by " + describe(other));
            }
        }

        if (conflicts.isEmpty()) {
            return;
        }

        List<String> reported = conflicts.stream().limit(MAX_REPORTED_CONFLICTS).toList();
        String suffix = conflicts.size() > reported.size()
                ? " (+" + (conflicts.size() - reported.size()) + " more)"
                : "";
        throw new ConflictException("Schedule conflict: " + String.join("; ", reported) + suffix);
    }

    private static String describe(Session other) {
        return "'" + other.getTitle() + "' (session #" + other.getId() + ", "
                + other.getStartTime().format(SLOT_FORMAT) + " - " + other.getEndTime().format(SLOT_FORMAT) + ")";
    }

    @Override
    public List<SessionDTO> createValidatedBatch(List<SessionDTO> requests) {
        checkPermission(CrudAction.CREATE);
        if (requests == null || requests.isEmpty()) {
            return List.of();
        }

        List<Session> toSave = new java.util.ArrayList<>(requests.size());
        for (SessionDTO r : requests) {
            ValidationContext ctx = new ValidationContext();
            if (r.getClassId() == null) {
                ctx.add("classId", "Class ID is required");
            }
            if (r.getTopicId() == null) {
                ctx.add("topicId", "Topic ID is required");
            }
            if (r.getTrainerId() == null) {
                ctx.add("trainerId", "Trainer ID is required");
            }
            if (r.getTitle() == null || r.getTitle().isBlank()) {
                ctx.add("title", "Title is required");
            }
            validateSessionTime(r.getStartTime(), r.getEndTime(), ctx);
            validateText(r.getTitle(), r.getLocation(), ctx);
            validateTopic(r.getTopicId(), ctx);
            ctx.throwIfErrors();

            Session entity = sessionMapper.toEntity(r);
            entity.initializeForSchedule(r.getTitle().trim(), normalizeLocation(r.getLocation()));

            ensureNoBatchOverlap(entity, toSave);
            ensureNoScheduleConflict(NO_SESSION, entity.getClassId(), entity.getTrainerId(),
                    entity.getLocation(), entity.getStartTime(), entity.getEndTime());

            toSave.add(entity);
        }
        return sessionRepository.saveAll(toSave).stream()
                .map(sessionMapper::toDto)
                .toList();
    }

    private static void ensureNoBatchOverlap(Session candidate, List<Session> earlier) {
        for (Session other : earlier) {
            boolean overlaps = candidate.getStartTime().isBefore(other.getEndTime())
                    && candidate.getEndTime().isAfter(other.getStartTime());
            if (!overlaps) {
                continue;
            }
            if (Objects.equals(candidate.getClassId(), other.getClassId())) {
                throw new ConflictException("Schedule conflict within batch: Class #" + candidate.getClassId()
                        + " already has '" + other.getTitle() + "' in this time slot.");
            }
            if (Objects.equals(candidate.getTrainerId(), other.getTrainerId())) {
                throw new ConflictException("Schedule conflict within batch: Trainer #" + candidate.getTrainerId()
                        + " is already assigned to '" + other.getTitle() + "' in this time slot.");
            }
            if (candidate.getLocation() != null && candidate.getLocation().equalsIgnoreCase(other.getLocation())) {
                throw new ConflictException("Schedule conflict within batch: Room '" + candidate.getLocation()
                        + "' is already used by '" + other.getTitle() + "' in this time slot.");
            }
        }
    }

    @Override
    public void deleteByClassId(Long classId) {
        checkPermission(CrudAction.DELETE);
        List<Session> sessions = sessionRepository.findByClassId(classId);
        if (!sessions.isEmpty()) {
            sessionRepository.deleteAll(sessions);
            sessionRepository.flush();
        }
    }
}