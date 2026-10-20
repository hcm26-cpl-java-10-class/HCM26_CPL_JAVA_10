package com.example.starter_project_2025.system.schedule.session;

import com.example.starter_project_2025.system.schedule.calendar.crud.CalendarLock;
import com.example.starter_project_2025.system.schedule.calendar.crud.CalendarRules;

import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.online_lession.LessonRepository;
import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.session.dto.SessionDTO;
import jakarta.validation.Validator;
import jakarta.validation.groups.Default;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class SessionValidator {

    private final LessonRepository lessonRepository;
    private final UserRepository userRepository;
    private final ExternalApiService externalApiService;
    private final Validator validator;
    private final CalendarLock locks;
    private final CalendarRules rules;

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
        CalendarVersion version = locks.version(versionId);
        if (!Boolean.TRUE.equals(version.getIsActive()) || !Boolean.TRUE.equals(version.getCalendar().getIsActive())) {
            throw new ResourceNotFoundException("Calendar version not found.");
        }
        rules.requireDraft(version);
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
        var calendar = entity.getCalendarVersion().getCalendar();
        rules.sessionForCalendar(calendar, entity.getStartTime(), entity.getEndTime(), "", errors);
        if (calendar.getClassStartDate() != null && calendar.getClassEndDate() != null) {
            if (entity.getClassCode() == null || entity.getClassCode().isBlank()) {
                entity.setClassCode(String.valueOf(calendar.getClassId()));
            }
            return;
        }
        var classInfo = externalApiService.fetchClassById(calendar.getClassId());
        if (classInfo == null || !calendar.getClassId().equals(classInfo.getId())
                || classInfo.getCode() == null || classInfo.getCode().isBlank()) {
            errors.add("classCode", "Class code is unavailable.");
        } else {
            entity.setClassCode(classInfo.getCode());
        }
    }
}
