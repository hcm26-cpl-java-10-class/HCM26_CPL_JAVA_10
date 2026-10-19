package com.example.starter_project_2025.system.schedule_validation;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class ScheduleValidationServiceImpl implements ScheduleValidationService {

    private final SessionRepository sessionRepository;

    @Override
    public ScheduleValidationResult validate(SessionConflictCandidate candidate) {
        return validateBatch(Collections.singletonList(candidate));
    }

    @Override
    public ScheduleValidationResult validateBatch(List<SessionConflictCandidate> candidates) {
        List<SessionConflictCandidate> safeCandidates = candidates == null
                ? Collections.emptyList()
                : candidates;
        List<ScheduleConflict> conflicts = new ArrayList<>();

        for (int index = 0; index < safeCandidates.size(); index++) {
            validatePersistedConflicts(safeCandidates.get(index), index, conflicts);
        }

        validateBatchConflicts(safeCandidates, conflicts);
        return ScheduleValidationResult.from(conflicts);
    }

    @Override
    public void addValidationErrors(SessionConflictCandidate candidate, ValidationContext context) {
        ScheduleValidationResult result = validate(candidate);
        result.getConflicts().forEach(conflict -> context.add(conflict.getField(), conflict.getMessage()));
    }

    private void validatePersistedConflicts(
            SessionConflictCandidate candidate,
            int candidateIndex,
            List<ScheduleConflict> conflicts) {
        if (!hasValidTimeRange(candidate)) {
            conflicts.add(invalidTimeConflict(candidateIndex));
            return;
        }

        if (candidate.getClassId() != null) {
            sessionRepository.findClassConflicts(
                            candidate.getClassId(),
                            candidate.getStartTime(),
                            candidate.getEndTime(),
                            candidate.getSessionId(),
                            Session.SessionStatus.CANCELLED)
                    .forEach(session -> conflicts.add(persistedConflict(
                            candidateIndex, ScheduleConflictType.CLASS_OVERLAP, "classId", session)));
        }

        if (candidate.getTrainerId() != null) {
            sessionRepository.findTrainerConflicts(
                            candidate.getTrainerId(),
                            candidate.getStartTime(),
                            candidate.getEndTime(),
                            candidate.getSessionId(),
                            Session.SessionStatus.CANCELLED)
                    .forEach(session -> conflicts.add(persistedConflict(
                            candidateIndex, ScheduleConflictType.TRAINER_OVERLAP, "trainerId", session)));
        }

        if (!isBlank(candidate.getLocation())) {
            sessionRepository.findRoomConflicts(
                            candidate.getLocation(),
                            candidate.getStartTime(),
                            candidate.getEndTime(),
                            candidate.getSessionId(),
                            Session.SessionStatus.CANCELLED)
                    .forEach(session -> conflicts.add(persistedConflict(
                            candidateIndex, ScheduleConflictType.ROOM_OVERLAP, "location", session)));
        }
    }

    private void validateBatchConflicts(
            List<SessionConflictCandidate> candidates,
            List<ScheduleConflict> conflicts) {
        for (int left = 0; left < candidates.size(); left++) {
            SessionConflictCandidate first = candidates.get(left);
            if (!hasValidTimeRange(first)) {
                continue;
            }

            for (int right = left + 1; right < candidates.size(); right++) {
                SessionConflictCandidate second = candidates.get(right);
                if (!hasValidTimeRange(second) || isSamePersistedSession(first, second)
                        || !overlaps(first, second)) {
                    continue;
                }

                if (same(first.getClassId(), second.getClassId())) {
                    conflicts.add(batchConflict(left, ScheduleConflictType.CLASS_OVERLAP, "classId", right, second));
                    conflicts.add(batchConflict(right, ScheduleConflictType.CLASS_OVERLAP, "classId", left, first));
                }
                if (same(first.getTrainerId(), second.getTrainerId())) {
                    conflicts.add(batchConflict(left, ScheduleConflictType.TRAINER_OVERLAP, "trainerId", right, second));
                    conflicts.add(batchConflict(right, ScheduleConflictType.TRAINER_OVERLAP, "trainerId", left, first));
                }
                if (sameLocation(first.getLocation(), second.getLocation())) {
                    conflicts.add(batchConflict(left, ScheduleConflictType.ROOM_OVERLAP, "location", right, second));
                    conflicts.add(batchConflict(right, ScheduleConflictType.ROOM_OVERLAP, "location", left, first));
                }
            }
        }
    }

    private ScheduleConflict persistedConflict(
            int candidateIndex,
            ScheduleConflictType type,
            String field,
            Session session) {
        return ScheduleConflict.builder()
                .candidateIndex(candidateIndex)
                .type(type)
                .field(field)
                .message(messageFor(type, describeSession(session)))
                .conflictingSessionId(session.getId())
                .conflictingSessionTitle(session.getTitle())
                .conflictingStartTime(session.getStartTime())
                .conflictingEndTime(session.getEndTime())
                .build();
    }

    private ScheduleConflict batchConflict(
            int candidateIndex,
            ScheduleConflictType type,
            String field,
            int conflictingCandidateIndex,
            SessionConflictCandidate conflictingCandidate) {
        return ScheduleConflict.builder()
                .candidateIndex(candidateIndex)
                .type(type)
                .field(field)
                .message(messageFor(type, "buổi học thứ " + (conflictingCandidateIndex + 1) + " trong danh sách"))
                .conflictingSessionId(conflictingCandidate.getSessionId())
                .conflictingStartTime(conflictingCandidate.getStartTime())
                .conflictingEndTime(conflictingCandidate.getEndTime())
                .build();
    }

    private ScheduleConflict invalidTimeConflict(int candidateIndex) {
        return ScheduleConflict.builder()
                .candidateIndex(candidateIndex)
                .type(ScheduleConflictType.INVALID_TIME)
                .field("endTime")
                .message("Thời gian kết thúc phải sau thời gian bắt đầu.")
                .build();
    }

    private String messageFor(ScheduleConflictType type, String conflictingSession) {
        return switch (type) {
            case CLASS_OVERLAP -> "Lớp học đã có lịch trùng với " + conflictingSession + ".";
            case TRAINER_OVERLAP -> "Giảng viên đã được xếp lịch trùng với " + conflictingSession + ".";
            case ROOM_OVERLAP -> "Phòng học hoặc địa điểm đã được sử dụng bởi " + conflictingSession + ".";
            case INVALID_TIME -> "Thời gian kết thúc phải sau thời gian bắt đầu.";
        };
    }

    private String describeSession(Session session) {
        String title = isBlank(session.getTitle()) ? "buổi học" : "buổi học \"" + session.getTitle().trim() + "\"";
        return title + " (mã session #" + session.getId() + ")";
    }

    private boolean hasValidTimeRange(SessionConflictCandidate candidate) {
        return candidate != null
                && candidate.getStartTime() != null
                && candidate.getEndTime() != null
                && candidate.getEndTime().isAfter(candidate.getStartTime());
    }

    private boolean overlaps(SessionConflictCandidate first, SessionConflictCandidate second) {
        return first.getStartTime().isBefore(second.getEndTime())
                && first.getEndTime().isAfter(second.getStartTime());
    }

    private boolean isSamePersistedSession(SessionConflictCandidate first, SessionConflictCandidate second) {
        return first.getSessionId() != null && first.getSessionId().equals(second.getSessionId());
    }

    private boolean same(Long first, Long second) {
        return first != null && first.equals(second);
    }

    private boolean sameLocation(String first, String second) {
        return !isBlank(first) && !isBlank(second) && first.trim().equalsIgnoreCase(second.trim());
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
