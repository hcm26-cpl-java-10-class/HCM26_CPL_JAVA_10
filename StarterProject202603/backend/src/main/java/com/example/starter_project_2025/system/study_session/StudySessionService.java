package com.example.starter_project_2025.system.study_session;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;

public interface StudySessionService
        extends BaseCrudService<Long, StudySessionDTO, StudySessionFilter> {
    StudySessionStatistics statistics(Long subjectId, java.time.LocalDate dateFrom, java.time.LocalDate dateTo);


        StudySessionDTO updateStatus(Long id, Boolean isActive);

        StudySessionDTO cancel(Long id, CancelSessionRequest request);

        StudySessionDTO complete(Long id, CompleteSessionRequest request);
}