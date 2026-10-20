package com.example.starter_project_2025.system.schedule.conflict;

import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalRoomDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalTrainerDTO;
import com.example.starter_project_2025.system.schedule.conflict.dto.ScheduleConflictIssue;
import com.example.starter_project_2025.system.schedule.conflict.dto.ScheduleValidationRequest;
import com.example.starter_project_2025.system.schedule.conflict.dto.ScheduleValidationResponse;
import com.example.starter_project_2025.system.schedule.conflict.dto.SessionCandidateRequest;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ScheduleConflictServiceImpl implements ScheduleConflictService {

    SessionRepository sessionRepository;
    ExternalApiService externalApiService;

    @Override
    @Transactional(readOnly = true)
    public ScheduleValidationResponse validateCandidates(Long versionId, ScheduleValidationRequest request) {
        List<ScheduleConflictIssue> issues = new ArrayList<>();
        Map<Long, ExternalClassDTO> classes = new HashMap<>();
        Map<Long, ExternalRoomDTO> rooms = new HashMap<>();
        Map<SessionCandidateRequest, String> resolvedLocations = new IdentityHashMap<>();
        Set<Long> activeTrainerIds = null;
        List<SessionCandidateRequest> candidates = request.getSessions();
        Set<String> candidateKeys = new HashSet<>();

        if (candidates.stream().anyMatch(candidate -> candidate.getRoomId() != null)) {
            for (ExternalRoomDTO room : externalApiService.fetchRooms()) {
                if (room.getId() != null) rooms.put(room.getId(), room);
            }
        }

        for (SessionCandidateRequest candidate : candidates) {
            if (!candidateKeys.add(candidate.getCandidateKey())) {
                addIssue(issues, "DUPLICATE_CANDIDATE_KEY", candidate, "candidateKey",
                        "candidateKey phải là duy nhất trong request.", null, null);
            }
            if (candidate.getStartAt() == null || candidate.getEndAt() == null) {
                continue; // Bean Validation reports the missing required field.
            }
            if (!candidate.getEndAt().isAfter(candidate.getStartAt())) {
                addIssue(issues, "INVALID_TIME", candidate, "endAt",
                        "Thời điểm kết thúc phải sau thời điểm bắt đầu.", null, null);
                continue;
            }
            if (candidate.getRoomId() == null && !StringUtils.hasText(candidate.getLocation())
                    && !StringUtils.hasText(candidate.getMeetingUrl())) {
                addIssue(issues, "LOCATION_REQUIRED", candidate, "location",
                        "Cần chọn phòng hoặc cung cấp meetingUrl.", null, null);
            }

            Long excludedSessionId = resolveExcludedSessionId(candidate, issues);

            ExternalClassDTO externalClass = classes.computeIfAbsent(
                    candidate.getClassId(), externalApiService::fetchClassById);
            validateClass(candidate, externalClass, issues);

            if (activeTrainerIds == null) {
                activeTrainerIds = new HashSet<>();
                for (ExternalTrainerDTO trainer : externalApiService.fetchTrainers("active")) {
                    if (trainer.getId() != null) activeTrainerIds.add(trainer.getId());
                }
            }
            if (!activeTrainerIds.contains(candidate.getTrainerId())) {
                addIssue(issues, "TRAINER_INACTIVE", candidate, "trainerId",
                        "Giảng viên không tồn tại hoặc không hoạt động.", null, null);
            }

            String conflictLocation = resolveLocation(candidate, rooms, issues);
            resolvedLocations.put(candidate, conflictLocation);
            validateAgainstStoredSessions(candidate, conflictLocation, excludedSessionId, issues);
        }

        validateBatchConflicts(candidates, resolvedLocations, issues);

        return ScheduleValidationResponse.builder()
                .versionId(versionId)
                .valid(issues.isEmpty())
                .issues(List.copyOf(issues))
                .build();
    }

    private void validateClass(SessionCandidateRequest candidate, ExternalClassDTO externalClass,
                               List<ScheduleConflictIssue> issues) {
        if (externalClass == null || externalClass.getId() == null) {
            addIssue(issues, "CLASS_NOT_FOUND", candidate, "classId",
                    "Không tìm thấy lớp.", null, null);
            return;
        }
        if (StringUtils.hasText(externalClass.getStatus())
                && !"active".equalsIgnoreCase(externalClass.getStatus())) {
            addIssue(issues, "CLASS_INACTIVE", candidate, "classId",
                    "Lớp không ở trạng thái hoạt động.", null, null);
        }

        try {
            LocalDate classStart = parseDate(externalClass.getStartDate());
            LocalDate classEnd = parseDate(externalClass.getEndDate());
            if (classStart != null && candidate.getStartAt().toLocalDate().isBefore(classStart)) {
                addIssue(issues, "OUTSIDE_CLASS_RANGE", candidate, "startAt",
                        "Buổi học bắt đầu trước ngày khai giảng của lớp.", null, null);
            }
            if (classEnd != null && candidate.getEndAt().isAfter(classEnd.plusDays(1).atStartOfDay())) {
                addIssue(issues, "OUTSIDE_CLASS_RANGE", candidate, "endAt",
                        "Buổi học kết thúc sau ngày kết thúc của lớp.", null, null);
            }
        } catch (DateTimeParseException ex) {
            addIssue(issues, "CLASS_DATE_INVALID", candidate, "classId",
                    "Ngày bắt đầu hoặc kết thúc lớp có định dạng không hợp lệ.", null, null);
        }
    }

    private LocalDate parseDate(String value) {
        return StringUtils.hasText(value) ? LocalDate.parse(value.trim()) : null;
    }

    private Long resolveExcludedSessionId(SessionCandidateRequest candidate,
                                           List<ScheduleConflictIssue> issues) {
        if (candidate.getSessionId() == null) return null;

        Session existing = sessionRepository.findById(candidate.getSessionId()).orElse(null);
        if (existing == null || !Boolean.TRUE.equals(existing.getIsActive())) {
            addIssue(issues, "SESSION_NOT_FOUND", candidate, "sessionId",
                    "Không tìm thấy buổi học cần cập nhật.", null, null);
            return null;
        }
        if (!candidate.getClassId().equals(existing.getClassId())) {
            addIssue(issues, "SESSION_MISMATCH", candidate, "sessionId",
                    "Buổi học cần cập nhật không thuộc lớp trong request.",
                    existing.getId(), null);
            return null;
        }
        if (existing.getStatus() != Session.SessionStatus.SCHEDULED) {
            addIssue(issues, "SESSION_NOT_EDITABLE", candidate, "sessionId",
                    "Chỉ buổi học đã xếp lịch mới có thể kiểm tra để cập nhật.",
                    existing.getId(), null);
            return null;
        }
        return existing.getId();
    }

    private String resolveLocation(SessionCandidateRequest candidate, Map<Long, ExternalRoomDTO> rooms,
                                   List<ScheduleConflictIssue> issues) {
        if (candidate.getRoomId() != null) {
            ExternalRoomDTO room = rooms.get(candidate.getRoomId());
            if (room == null) {
                addIssue(issues, "ROOM_NOT_FOUND", candidate, "roomId",
                        "Không tìm thấy phòng trong danh mục dùng chung.", null, null);
                return null;
            }
            return room.getName();
        }
        return StringUtils.hasText(candidate.getLocation()) ? candidate.getLocation().trim() : null;
    }

    private void validateAgainstStoredSessions(SessionCandidateRequest candidate, String location,
                                               Long excludedSessionId,
                                               List<ScheduleConflictIssue> issues) {
        List<Session> overlaps = sessionRepository.findOverlappingSessions(
                candidate.getClassId(), candidate.getTrainerId(), location,
                candidate.getStartAt(), candidate.getEndAt(), excludedSessionId,
                Session.SessionStatus.CANCELLED);

        for (Session existing : overlaps) {
            if (candidate.getClassId().equals(existing.getClassId())) {
                addIssue(issues, "CLASS_CONFLICT", candidate, "startAt",
                        "Lớp đã có buổi học khác trong khoảng thời gian này.", existing.getId(), null);
            }
            if (candidate.getTrainerId().equals(existing.getTrainerId())) {
                addIssue(issues, "TRAINER_CONFLICT", candidate, "trainerId",
                        "Giảng viên đã có buổi học khác trong khoảng thời gian này.", existing.getId(), null);
            }
            if (location != null && existing.getLocation() != null
                    && location.equalsIgnoreCase(existing.getLocation().trim())) {
                addIssue(issues, "ROOM_CONFLICT", candidate, "roomId",
                        "Phòng đã có lịch trong khoảng thời gian này.", existing.getId(), null);
            }
        }
    }

    private void validateBatchConflicts(List<SessionCandidateRequest> candidates,
                                        Map<SessionCandidateRequest, String> resolvedLocations,
                                        List<ScheduleConflictIssue> issues) {
        for (int i = 0; i < candidates.size(); i++) {
            SessionCandidateRequest first = candidates.get(i);
            if (!hasValidInterval(first)) continue;
            for (int j = i + 1; j < candidates.size(); j++) {
                SessionCandidateRequest second = candidates.get(j);
                if (!hasValidInterval(second) || !overlaps(first, second)) continue;

                if (first.getClassId().equals(second.getClassId())) {
                    addBatchIssue(issues, "BATCH_CONFLICT", first, "classId",
                            "Hai buổi trong cùng request bị trùng lớp.", second.getCandidateKey());
                    addBatchIssue(issues, "BATCH_CONFLICT", second, "classId",
                            "Hai buổi trong cùng request bị trùng lớp.", first.getCandidateKey());
                }
                if (first.getTrainerId().equals(second.getTrainerId())) {
                    addBatchIssue(issues, "BATCH_CONFLICT", first, "trainerId",
                            "Hai buổi trong cùng request bị trùng giảng viên.", second.getCandidateKey());
                    addBatchIssue(issues, "BATCH_CONFLICT", second, "trainerId",
                            "Hai buổi trong cùng request bị trùng giảng viên.", first.getCandidateKey());
                }
                if (sameRoom(first, second, resolvedLocations)) {
                    addBatchIssue(issues, "BATCH_CONFLICT", first, "roomId",
                            "Hai buổi trong cùng request bị trùng phòng.", second.getCandidateKey());
                    addBatchIssue(issues, "BATCH_CONFLICT", second, "roomId",
                            "Hai buổi trong cùng request bị trùng phòng.", first.getCandidateKey());
                }
            }
        }
    }

    private boolean sameRoom(SessionCandidateRequest first, SessionCandidateRequest second,
                             Map<SessionCandidateRequest, String> resolvedLocations) {
        String firstLocation = resolvedLocations.get(first);
        String secondLocation = resolvedLocations.get(second);
        return StringUtils.hasText(firstLocation) && StringUtils.hasText(secondLocation)
                && firstLocation.trim().equalsIgnoreCase(secondLocation.trim());
    }

    private boolean hasValidInterval(SessionCandidateRequest candidate) {
        return candidate.getStartAt() != null && candidate.getEndAt() != null
                && candidate.getEndAt().isAfter(candidate.getStartAt());
    }

    private boolean overlaps(SessionCandidateRequest first, SessionCandidateRequest second) {
        return first.getStartAt().isBefore(second.getEndAt())
                && first.getEndAt().isAfter(second.getStartAt());
    }

    private void addIssue(List<ScheduleConflictIssue> issues, String code,
                          SessionCandidateRequest candidate, String field, String message,
                          Long conflictSessionId, String conflictCandidateKey) {
        issues.add(ScheduleConflictIssue.builder()
                .code(code)
                .candidateKey(candidate.getCandidateKey())
                .field(field)
                .message(message)
                .conflictSessionId(conflictSessionId)
                .conflictCandidateKey(conflictCandidateKey)
                .build());
    }

    private void addBatchIssue(List<ScheduleConflictIssue> issues, String code,
                               SessionCandidateRequest candidate, String field, String message,
                               String conflictCandidateKey) {
        addIssue(issues, code, candidate, field, message, null, conflictCandidateKey);
    }
}
