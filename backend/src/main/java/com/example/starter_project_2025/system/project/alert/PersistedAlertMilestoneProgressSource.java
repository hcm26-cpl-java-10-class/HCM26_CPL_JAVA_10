package com.example.starter_project_2025.system.project.alert;
import lombok.RequiredArgsConstructor;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Component;
import java.util.*;
@Component @RequiredArgsConstructor
public class PersistedAlertMilestoneProgressSource implements AlertMilestoneProgressSource {
    private final EntityManager em;
    public Optional<Set<Long>> backlogItemIds(UUID milestoneId,Long teamId,Long tenantId) {
        // The backlog's milestone relation is the source of truth, including Done work.
        return Optional.of(new HashSet<>(em.createQuery("select b.id from SprintBacklog b join b.milestone m "
                +"where b.isActive=true and m.id=:milestone and m.teamId=:team and m.tenantId=:tenant and m.active=true",Long.class)
                .setParameter("milestone",milestoneId).setParameter("team",teamId).setParameter("tenant",tenantId).getResultList()));
    }
}
