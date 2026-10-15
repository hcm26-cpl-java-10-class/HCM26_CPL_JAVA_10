package com.example.starter_project_2025.system.schedule.session;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.schedule.session.dto.SessionResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SessionServiceImpl implements SessionService {

    private final SessionRepository sessionRepository;
    private final SessionMapper sessionMapper;
    private final SessionAccessPolicy accessPolicy;

    @Override
    public SessionResponse getById(Long sessionId) {
        Authentication actor = accessPolicy.requireReadPermission();
        if (sessionId == null || sessionId <= 0) {
            throw new BadRequestException("Session ID must be a positive number.");
        }

        Session session = sessionRepository.findByIdAndIsActiveTrue(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found."));
        SessionReadContextProvider.ReadContext context = accessPolicy.requireReadableContext(session, actor);
        return sessionMapper.toResponse(session, context);
    }
}
