package com.example.starter_project_2025.system.schedule.session;

import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.online_lession.LessonRepository;
import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarVersionRepository;
import com.example.starter_project_2025.system.schedule.session.dto.SessionDTO;
import jakarta.validation.Validator;
import jakarta.validation.groups.Default;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

@Component
@RequiredArgsConstructor
public class SessionValidator {

    private final CalendarVersionRepository calendarVersionRepository;
    private final LessonRepository lessonRepository;
    private final UserRepository userRepository;
    private final ExternalApiService externalApiService;
    private final Validator validator;

    public void validateCreateRequest(SessionDTO request, ValidationContext errors) {
        validator.validate(request, Default.class, OnCreate.class).forEach(violation ->
                errors.add(violation.getPropertyPath().toString(), violation.getMessage()));
        errors.throwIfErrors();
    }

    public void validateUpdateRequest(SessionDTO request, ValidationContext errors) {
        validator.validate(request, Default.class, OnUpdate.class).forEach(violation ->
                errors.add(violation.getPropertyPath().toString(), violation.getMessage()));
        errors.throwIfErrors();
    }

    public CalendarVersion requireDraftVersion(Long versionId, ValidationContext errors) {
        if (versionId == null || versionId <= 0) {
            errors.add("calendarVersionId", "A valid calendar version ID is required.");
            errors.throwIfErrors();
        }
        CalendarVersion version = calendarVersionRepository.findById(versionId)
                .filter(value -> Boolean.TRUE.equals(value.getIsActive()))
                .filter(value -> value.getCalendar() != null && Boolean.TRUE.equals(value.getCalendar().getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException("Calendar version not found."));
        version = calendarVersionRepository.findActiveByIdForUpdate(version.getCalendar().getId(), versionId)
                .orElseThrow(() -> new ResourceNotFoundException("Calendar version not found."));
        if (version.getStatus() != CalendarVersionStatus.DRAFT) {
            throw new ConflictException("Sessions can only be scheduled in a DRAFT calendar version.");
        }
        return version;
    }

    public void validateReferences(Session entity, SessionDTO request, ValidationContext errors) {
        if (request.getTopicId() == null || request.getTopicId() <= 0) {
            errors.add("topicId", "A valid topic ID is required.");
        } else {
            lessonRepository.findById(request.getTopicId())
                    .filter(lesson -> Boolean.TRUE.equals(lesson.getIsActive()))
                    .ifPresentOrElse(lesson -> entity.setTopicName(lesson.getTitle()),
                            () -> errors.add("topicId", "Topic was not found or is inactive."));
        }
        if (request.getTrainerId() == null || request.getTrainerId() <= 0) {
            errors.add("trainerId", "A valid trainer ID is required.");
        } else {
            userRepository.findById(request.getTrainerId())
                    .filter(user -> Boolean.TRUE.equals(user.getIsActive()))
                    .ifPresentOrElse(user -> {
                        String name = ((user.getFirstName() == null ? "" : user.getFirstName()) + " "
                                + (user.getLastName() == null ? "" : user.getLastName())).trim();
                        entity.setTrainerName(name.isBlank() ? user.getEmail() : name);
                    }, () -> errors.add("trainerId", "Trainer was not found or is inactive."));
        }
    }

    public void validateClassDates(Session entity, ValidationContext errors) {
        Long classId = entity.getCalendarVersion().getCalendar().getClassId();
        var classInfo = externalApiService.fetchClassById(classId);
        if (classInfo == null || !classId.equals(classInfo.getId())) {
            errors.add("classCode", "Class information is unavailable.");
            return;
        }
        if (classInfo.getCode() == null || classInfo.getCode().isBlank()) {
            errors.add("classCode", "Class code is unavailable.");
        } else {
            entity.setClassCode(classInfo.getCode());
        }
        if (classInfo.getStartDate() == null || classInfo.getEndDate() == null) {
            errors.add("startTime", "Class start date and end date are required.");
            return;
        }
        LocalDate startDate;
        LocalDate endDate;
        try {
            startDate = LocalDate.parse(classInfo.getStartDate());
            endDate = LocalDate.parse(classInfo.getEndDate());
        } catch (java.time.format.DateTimeParseException ex) {
            errors.add("startTime", "Class dates must use yyyy-MM-dd.");
            return;
        }
        if (endDate.isBefore(startDate)) {
            errors.add("startTime", "Class date range is invalid.");
            return;
        }
        if (entity.getStartTime().toLocalDate().isBefore(startDate)) {
            errors.add("startTime", "Session starts before the class start date.");
        }
        if (entity.getEndTime().toLocalDate().isAfter(endDate)) {
            errors.add("endTime", "Session ends after the class end date.");
        }
    }
}
