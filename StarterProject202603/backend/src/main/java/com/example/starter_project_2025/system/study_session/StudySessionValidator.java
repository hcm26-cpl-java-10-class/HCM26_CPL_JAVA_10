package com.example.starter_project_2025.system.study_session;

import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class StudySessionValidator {

    public static final String TITLE_NONBLANK_PATTERN = "(?s).*[^\\s\\p{Z}\\uFEFF].*";
    public static final String ROOM_PATTERN = "(?:|(?=.*\\S)[\\p{L}\\p{M}\\p{N} .,/#()_\\-:&]+)";
    public static final String LECTURER_PATTERN = "(?=.*\\p{L})[\\p{L}\\p{M}\\p{N} .'’()\\-]+";

    private final Validator validator;

    public void validate(StudySessionDTO request, ValidationContext ctx) {
        validator.validate(request, OnCreate.class).forEach(violation ->
                ctx.add(violation.getPropertyPath().toString(), violation.getMessage()));

        if (request.getStartTime() != null && request.getEndTime() != null
                && !request.getEndTime().isAfter(request.getStartTime())) {
            ctx.add("endTime", "End time must be after start time");
        }
    }

    public void validateUpdate(StudySession existing, StudySessionDTO changes, ValidationContext ctx) {
        validate(effectiveRequest(existing, changes), ctx);
    }

    public void validateImport(StudySession session, ValidationContext ctx) {
        validate(effectiveRequest(session, new StudySessionDTO()), ctx);
    }

    // PUT currently ignores omitted/null fields. Validate the resulting values without mutating the entity.
    private StudySessionDTO effectiveRequest(StudySession existing, StudySessionDTO changes) {
        StudySessionDTO request = StudySessionDTO.builder()
                .subjectId(changes.getSubjectId() != null ? changes.getSubjectId() : existing.getSubjectId())
                .title(changes.getTitle() != null ? changes.getTitle() : existing.getTitle())
                .sessionDate(changes.getSessionDate() != null ? changes.getSessionDate() : existing.getSessionDate())
                .startTime(changes.getStartTime() != null ? changes.getStartTime() : existing.getStartTime())
                .endTime(changes.getEndTime() != null ? changes.getEndTime() : existing.getEndTime())
                .room(changes.getRoom() != null ? changes.getRoom() : existing.getRoom())
                .lecturer(changes.getLecturer() != null ? changes.getLecturer() : existing.getLecturer())
                .type(changes.getType() != null ? changes.getType() : existing.getType())
                .description(changes.getDescription() != null ? changes.getDescription() : existing.getDescription())
                .build();
        request.setIsActive(changes.getIsActive() != null ? changes.getIsActive() : existing.getIsActive());
        return request;
    }
}
