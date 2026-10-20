package com.example.starter_project_2025.system.study_session;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;

public interface StudySessionService
        extends BaseCrudService<Long, StudySessionDTO, StudySessionFilter> {

        StudySessionDTO updateStatus(Long id, Boolean isActive);

        StudySessionDTO cancel(Long id, CancelSessionRequest request);

        StudySessionDTO complete(Long id, CompleteSessionRequest request);
}