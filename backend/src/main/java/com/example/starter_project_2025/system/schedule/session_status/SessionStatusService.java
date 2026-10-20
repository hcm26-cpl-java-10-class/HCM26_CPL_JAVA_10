package com.example.starter_project_2025.system.schedule.session_status;

import com.example.starter_project_2025.system.schedule.SessionDTO;
import com.example.starter_project_2025.system.schedule.SessionStatus;
import com.example.starter_project_2025.system.schedule.dto.SessionCancelRequest;

public interface SessionStatusService {

    SessionDTO changeStatus(Long id, SessionStatus status);

    SessionDTO cancel(Long id, SessionCancelRequest request, Long expectedVersion);
}