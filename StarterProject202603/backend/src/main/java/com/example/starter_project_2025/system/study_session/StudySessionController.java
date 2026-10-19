package com.example.starter_project_2025.system.study_session;

import com.example.starter_project_2025.base.crud.controller.BaseCrudController;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/study-sessions")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Study Session", description = "APIs for managing study sessions")
public class StudySessionController
        extends BaseCrudController<Long, StudySessionDTO, StudySessionFilter> {

    StudySessionService studySessionService;

    @Override
    protected BaseCrudService<Long, StudySessionDTO, StudySessionFilter> getService() {
        return studySessionService;
    }
}