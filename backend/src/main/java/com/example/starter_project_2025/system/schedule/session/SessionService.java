package com.example.starter_project_2025.system.schedule.session;

import com.example.starter_project_2025.system.schedule.session.dto.SessionResponse;

public interface SessionService {
    SessionResponse getById(Long sessionId);
}
