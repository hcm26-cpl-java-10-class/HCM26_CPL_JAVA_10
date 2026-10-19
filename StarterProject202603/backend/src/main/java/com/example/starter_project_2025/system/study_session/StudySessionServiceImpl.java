package com.example.starter_project_2025.system.study_session;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class StudySessionServiceImpl
        extends BaseCrudServiceImpl<StudySession, Long, StudySessionDTO, StudySessionFilter>
        implements StudySessionService {

    StudySessionMapper studySessionMapper;
    StudySessionRepository studySessionRepository;

    @Override
    protected BaseCrudRepository<StudySession, Long> getRepository() {
        return studySessionRepository;
    }

    @Override
    protected BaseCrudMapper<StudySession, StudySessionDTO> getMapper() {
        return studySessionMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{"title", "room"};
    }

    @Override
    protected void beforeCreate(StudySession studySession, StudySessionDTO request, ValidationContext ctx) {
        if (request.getStartTime() != null && request.getEndTime() != null
                && !request.getEndTime().isAfter(request.getStartTime())) {
            ctx.add("endTime", "End time must be after start time");
        }

        if (isBlank(request.getRoom()) && isBlank(request.getOnlineLink())) {
            ctx.add("room", "Either room or online link is required");
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}