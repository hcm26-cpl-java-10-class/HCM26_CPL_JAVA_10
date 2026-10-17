package com.example.starter_project_2025.system.schedule.session;

import com.example.starter_project_2025.system.schedule.dto.SessionCancelRequest;
import com.example.starter_project_2025.system.schedule.session.dto.SessionDTO;
import com.example.starter_project_2025.system.schedule.session.dto.CreateSessionRequest;
import com.example.starter_project_2025.system.schedule.session.dto.SessionResponse;

public interface SessionService {
    SessionResponse getById(Long sessionId);

    SessionResponse create(Long calendarVersionId, CreateSessionRequest request);

    SessionDTO cancel(Long sessionId, SessionCancelRequest request, Long expectedVersion);
}
