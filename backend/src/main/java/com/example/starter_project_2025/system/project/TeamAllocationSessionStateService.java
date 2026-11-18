package com.example.starter_project_2025.system.project;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TeamAllocationSessionStateService {

    private final TeamAllocationSessionRepository sessionRepository;
    private final ProjectTeamRepository teamRepository;

    @Transactional
    public void closeAsPublishedWhenNoDrafts(Long sessionId) {
        TeamAllocationSession session = sessionRepository.findByIdForUpdate(sessionId)
                .orElseThrow();
        if (teamRepository.existsByAllocationSession_IdAndStatus(
                sessionId, ProjectTeamStatus.DRAFT)) {
            return;
        }
        session.setStatus(TeamAllocationSessionStatus.PUBLISHED);
    }
}
