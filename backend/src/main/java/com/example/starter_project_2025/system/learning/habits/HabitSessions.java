package com.example.starter_project_2025.system.learning.habits;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.time.temporal.ChronoUnit;
import static com.example.starter_project_2025.system.learning.habits.HabitDtos.*;
import static com.example.starter_project_2025.system.learning.habits.HabitPolicy.*;

@Service
@RequiredArgsConstructor
class HabitSessions {
    private final HabitSessionRepository sessions;
    private final HabitPolicy policy;

    enum Action {
        PAUSE(StudyState.PAUSED), RESUME(StudyState.RUNNING),
        FINISH(StudyState.COMPLETED), CANCEL(StudyState.CANCELLED);

        final StudyState result;
        Action(StudyState result) { this.result = result; }
    }

    @Transactional(readOnly = true)
    public Session active(Long owner) {
        Instant now = now();
        HabitSession session = sessions.findByActiveOwnerId(owner).orElse(null);
        return session == null || expired(session, now) ? null : view(session, now);
    }

    @Transactional
    public Session start(Long owner, boolean canRead, TimerInput input) {
        policy.lockOwner(owner);
        Instant now = now();
        HabitSession replay = replay(owner, input.requestKey().toString(), StudySource.TIMER);
        if (replay != null) {
            if (expired(replay, now)) expire(replay, now);
            return view(replay, now);
        }
        HabitSession previous = sessions.findByActiveOwnerId(owner).orElse(null);
        if (previous != null) {
            if (!expired(previous, now)) throw conflict("You already have a study timer");
            expire(previous, now);
            sessions.flush();
        }
        CourseOption course = policy.course(owner, input.courseId(), canRead);
        HabitSession session = create(owner, input.requestKey().toString(), course, StudySource.TIMER, now);
        String title = optional(input.title());
        session.title = title != null ? title : course.name() == null ? "General Study" : course.name();
        session.title = session.title.substring(0, session.title.offsetByCodePoints(0,
            Math.min(session.title.codePointCount(0, session.title.length()), 150)));
        session.studyDate = LocalDate.ofInstant(now, policy.zone());
        session.state = StudyState.RUNNING;
        session.activeOwnerId = owner;
        session.intervals.add(new StudyInterval(now));
        return view(sessions.saveAndFlush(session), now);
    }

    @Transactional
    public Session transition(Long owner, Long id, long version, Action action) {
        policy.lockOwner(owner);
        Instant now = now();
        HabitSession session = owned(owner, id);
        if (session.source != StudySource.TIMER) throw conflict("This record is a manual study log");
        if (expired(session, now)) {
            expire(session, now);
            sessions.flush();
        }
        if (session.state == action.result || session.state == StudyState.EXPIRED) return view(session, now);
        checkVersion(version, session.version);
        if (session.activeOwnerId == null) throw conflict("This timer has already ended");
        if (action == Action.RESUME) {
            session.intervals.add(new StudyInterval(now));
        } else if (session.state == StudyState.RUNNING) {
            closeInterval(session, now);
        }
        if (action == Action.FINISH && session.elapsedSeconds == 0) {
            throw bad("Study for at least one second before saving");
        }
        session.state = action.result;
        session.updatedAt = now;
        if (action == Action.FINISH || action == Action.CANCEL) {
            session.activeOwnerId = null;
            session.finishedAt = now;
        }
        sessions.flush();
        return view(session, now);
    }

    @Transactional
    public Session manual(Long owner, boolean canRead, StudyInput input) {
        if (input.requestKey() == null) throw bad("A request key is required");
        policy.lockOwner(owner);
        Instant now = now();
        HabitSession replay = replay(owner, input.requestKey().toString(), StudySource.MANUAL);
        if (replay != null) return view(replay, now);
        validateLog(input);
        CourseOption course = policy.course(owner, input.courseId(), canRead);
        HabitSession record = create(owner, input.requestKey().toString(), course, StudySource.MANUAL, now);
        record.state = StudyState.COMPLETED;
        record.finishedAt = now;
        applyLog(record, input, course, now);
        rejectDuplicate(record);
        return view(sessions.saveAndFlush(record), now);
    }

    @Transactional
    public Session edit(Long owner, Long id, boolean canRead, StudyInput input) {
        policy.lockOwner(owner);
        HabitSession record = completed(owner, id, input.version());
        boolean changedTime = !record.studyDate.equals(input.studyDate())
            || (record.elapsedSeconds + 59) / 60 != input.durationMinutes();
        if (record.source == StudySource.MANUAL || changedTime) validateLog(input);
        CourseOption course = java.util.Objects.equals(record.courseId, input.courseId())
            ? new CourseOption(record.courseId, record.courseName) : policy.course(owner, input.courseId(), canRead);
        if (record.source == StudySource.MANUAL || changedTime) {
            applyLog(record, input, course, now());
            if (record.source == StudySource.TIMER) {
                record.corrected = true;
                record.intervals.clear();
            } else {
                rejectDuplicate(record);
            }
        } else {
            applyDetails(record, input, course, now());
        }
        sessions.flush();
        return view(record, now());
    }

    @Transactional
    public void delete(Long owner, Long id, long version) {
        policy.lockOwner(owner);
        HabitSession record = completed(owner, id, version);
        // Keep the request key as an idempotency tombstone and remove user-entered content.
        record.deleted = true;
        record.title = "Deleted";
        record.notes = null;
        record.courseId = null;
        record.courseName = null;
        record.elapsedSeconds = 0;
        record.intervals.clear();
        record.updatedAt = now();
    }

    @Transactional(readOnly = true)
    public History history(Long owner, StudySource source, LocalDate from, LocalDate to, int page, int size) {
        validDate(from);
        validDate(to);
        if (from.isAfter(to) || page < 0 || size < 1 || size > 100) throw bad("Invalid history filters");
        var paging = PageRequest.of(page, size);
        // Use a Slice to fetch an extra row without a count query.
        var rows = source == null
            ? sessions.findByOwnerIdAndStateAndDeletedFalseAndStudyDateBetweenOrderByStudyDateDescIdDesc(
                owner, StudyState.COMPLETED, from, to, paging)
            : sessions.findByOwnerIdAndStateAndSourceAndDeletedFalseAndStudyDateBetweenOrderByStudyDateDescIdDesc(
                owner, StudyState.COMPLETED, source, from, to, paging);
        Instant now = now();
        return new History(rows.stream().map(row -> view(row, now)).toList(), rows.hasNext());
    }

    private HabitSession owned(Long owner, Long id) {
        return sessions.findByIdAndOwnerIdAndDeletedFalse(id, owner).orElseThrow(HabitPolicy::missing);
    }

    private HabitSession completed(Long owner, Long id, Long version) {
        HabitSession record = owned(owner, id);
        if (record.state != StudyState.COMPLETED) throw conflict("Only completed records can be changed");
        checkVersion(version, record.version);
        return record;
    }

    private HabitSession replay(Long owner, String key, StudySource source) {
        HabitSession replay = sessions.findByOwnerIdAndRequestKey(owner, key).orElse(null);
        if (replay != null && (replay.source != source || replay.deleted)) {
            throw conflict("This request key was already used");
        }
        return replay;
    }

    private HabitSession create(Long owner, String key, CourseOption course, StudySource source, Instant now) {
        HabitSession result = new HabitSession();
        result.ownerId = owner;
        result.requestKey = key;
        result.source = source;
        result.courseId = course.id();
        result.courseName = course.name();
        result.createdAt = now;
        result.updatedAt = now;
        result.zone = policy.zone().getId();
        return result;
    }

    private void validateLog(StudyInput input) {
        validDate(input.studyDate());
        if (input.studyDate().isAfter(policy.today())) throw bad("Study date cannot be in the future");
        if (input.durationMinutes() > policy.maxManualMinutes()) {
            throw bad("Study duration must be at most " + policy.maxManualMinutes() + " minutes");
        }
    }

    private void applyLog(HabitSession record, StudyInput input, CourseOption course, Instant now) {
        applyDetails(record, input, course, now);
        record.studyDate = input.studyDate();
        record.elapsedSeconds = input.durationMinutes() * 60L;
    }

    private void applyDetails(HabitSession record, StudyInput input, CourseOption course, Instant now) {
        record.title = input.title().strip();
        record.notes = optional(input.notes());
        record.courseId = course.id();
        record.courseName = course.name();
        record.updatedAt = now;
    }

    private void rejectDuplicate(HabitSession record) {
        boolean duplicate = sessions.findByOwnerIdAndSourceAndStateAndStudyDateAndDeletedFalse(
                record.ownerId, StudySource.MANUAL, StudyState.COMPLETED, record.studyDate).stream()
            .anyMatch(other -> !java.util.Objects.equals(record.id, other.id)
                && java.util.Objects.equals(record.courseId, other.courseId)
                && record.elapsedSeconds == other.elapsedSeconds && record.title.equalsIgnoreCase(other.title));
        if (duplicate) throw conflict("A matching manual study record already exists");
    }

    private Instant now() { return policy.now().truncatedTo(ChronoUnit.SECONDS); }

    private boolean expired(HabitSession session, Instant now) {
        return session.activeOwnerId != null && !now.isBefore(session.createdAt.plus(policy.timerLimit()));
    }

    private void expire(HabitSession session, Instant now) {
        session.state = StudyState.EXPIRED;
        session.activeOwnerId = null;
        session.elapsedSeconds = 0;
        session.intervals.clear();
        session.finishedAt = session.createdAt.plus(policy.timerLimit());
        session.updatedAt = now;
    }

    private void closeInterval(HabitSession session, Instant now) {
        StudyInterval interval = session.intervals.getLast();
        interval.stoppedAt = now.isBefore(interval.startedAt) ? interval.startedAt : now;
        session.elapsedSeconds += Duration.between(interval.startedAt, interval.stoppedAt).toSeconds();
    }

    private Session view(HabitSession row, Instant now) {
        long seconds = row.elapsedSeconds;
        if (row.state == StudyState.RUNNING) {
            seconds += Math.max(0, Duration.between(row.intervals.getLast().startedAt, now).toSeconds());
        }
        return new Session(row.id, row.version, row.courseId, row.courseName, row.title, row.notes,
            row.source, row.state, row.source == StudySource.MANUAL || row.corrected, row.studyDate, seconds,
            row.createdAt, row.finishedAt, now, row.activeOwnerId == null ? null : row.createdAt.plus(policy.timerLimit()));
    }
}
