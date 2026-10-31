package com.example.starter_project_2025.system.project.allocation;

import com.example.starter_project_2025.web.CorrelationIdFilter;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TemplateSearchAuditWriter {
    private final EntityManager entityManager;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void denied(Long actorId, Long tenantId, Long classId, Long teamId, String reason) {
        entityManager.persist(new TemplateSearchAudit(actorId, tenantId, classId, teamId,
                reason, CorrelationIdFilter.currentId()));
    }
}
