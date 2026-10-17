
package com.example.starter_project_2025.system.schedule.calendar.service;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.schedule.Session;
import com.example.starter_project_2025.system.schedule.SessionRepository;
import com.example.starter_project_2025.system.schedule.SessionStatus;
import com.example.starter_project_2025.system.schedule.calendar.*;
import com.example.starter_project_2025.system.schedule.calendar.dto.CalendarVersionResponse;
import com.example.starter_project_2025.system.schedule.calendar.dto.CreateCalendarVersionRequest;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarRepository;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarVersionRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;


@Service
@RequiredArgsConstructor
public class CalendarVersionServiceImpl implements CalendarVersionService {

    private final CalendarRepository calendarRepository;
    private final CalendarVersionRepository calendarVersionRepository;
    private final SessionRepository sessionRepository;
    private final CalendarVersionMapper calendarVersionMapper;

    @Override
    @Transactional
    public CalendarVersionResponse createVersion(
            Long calendarId,
            CreateCalendarVersionRequest request) {

        // 1. Validate request
        if (request == null || request.getMode() == null) {
            throw new IllegalArgumentException(
                    "Calendar version creation mode is required");
        }

        // 2. Lock Calendar để tránh cấp trùng version number
        Calendar calendar = calendarRepository
                .findActiveByIdForUpdate(calendarId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Active Calendar not found: " + calendarId));

        // 3. Tìm ACTIVE version
        var activeVersion =
                calendarVersionRepository.findActiveVersionByCalendarId(
                        calendarId,
                        CalendarVersionStatus.ACTIVE);

        // 4. COPY_ACTIVE phải có ACTIVE version
        if (request.getMode() == CalendarVersionCreationMode.COPY_ACTIVE
                && activeVersion.isEmpty()) {
            throw new IllegalArgumentException(
                    "Cannot copy because this Calendar has no ACTIVE version");
        }

        // 5. Cấp version number mới
        Integer lastIssued = calendar.getLastIssuedVersionNumber();

        if (lastIssued == null) {
            lastIssued = 0;
        }

        int nextVersionNumber = lastIssued + 1;
        calendar.setLastIssuedVersionNumber(nextVersionNumber);

        // 6. Tạo Version mới với trạng thái DRAFT
        CalendarVersion newVersion = CalendarVersion.builder()
                .calendar(calendar)
                .versionNumber(nextVersionNumber)
                .status(CalendarVersionStatus.DRAFT)
                .isActive(true)
                .build();

        CalendarVersion savedVersion =
                calendarVersionRepository.save(newVersion);

        // 7. COPY_ACTIVE thì sao chép Session
        if (request.getMode() == CalendarVersionCreationMode.COPY_ACTIVE) {

            CalendarVersion sourceVersion = activeVersion.orElseThrow();

            List<Session> sourceSessions =
                    sessionRepository.findByCalendarVersion_IdAndIsActiveTrue(
                            sourceVersion.getId());

            List<Session> copiedSessions = new ArrayList<>();

            for (Session source : sourceSessions) {
                Session copied = Session.builder()
                        .calendarVersion(savedVersion)
                        .classCode(source.getClassCode())
                        .topicName(source.getTopicName())
                        .trainerId(source.getTrainerId())
                        .trainerName(source.getTrainerName())
                        .title(source.getTitle())
                        .startTime(source.getStartTime())
                        .endTime(source.getEndTime())
                        .room(source.getRoom())
                        .meetingLink(source.getMeetingLink())
                        .status(SessionStatus.SCHEDULED)
                        .notes(null)
                        .isOverridden(false)
                        .overrideReason(null)
                        .isActive(true)
                        .build();

                copiedSessions.add(copied);
            }

            sessionRepository.saveAll(copiedSessions);
        }

        // 8. Dùng Mapper để chuyển Entity thành response DTO
        return calendarVersionMapper.toResponse(savedVersion);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<CalendarVersionResponse> getVersions(
            Long calendarId,
            CalendarVersionFilter filter,
            Pageable pageable) {

        calendarRepository.findById(calendarId)
                .filter(calendar -> Boolean.TRUE.equals(calendar.getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Active Calendar not found: " + calendarId));

        CalendarVersionFilter versionFilter =
                filter == null ? new CalendarVersionFilter() : filter;

        Specification<CalendarVersion> specification = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            predicates.add(cb.isTrue(root.get("isActive")));
            predicates.add(cb.equal(root.get("calendar").get("id"), calendarId));

            if (versionFilter.getClassId() != null) {
                predicates.add(cb.equal(
                        root.get("calendar").get("classId"),
                        versionFilter.getClassId()
                ));
            }

            if (versionFilter.getStatus() != null) {
                predicates.add(cb.equal(
                        root.get("status"),
                        versionFilter.getStatus()
                ));
            }

            if (versionFilter.getVersionNumber() != null) {
                predicates.add(cb.equal(
                        root.get("versionNumber"),
                        versionFilter.getVersionNumber()
                ));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Pageable sortedPageable = PageRequest.of(
                pageable.getPageNumber(),
                pageable.getPageSize(),
                Sort.by(Sort.Direction.DESC, "versionNumber")
        );

        return calendarVersionRepository.findAll(specification, sortedPageable)
                .map(calendarVersionMapper::toResponse);
    }


}
