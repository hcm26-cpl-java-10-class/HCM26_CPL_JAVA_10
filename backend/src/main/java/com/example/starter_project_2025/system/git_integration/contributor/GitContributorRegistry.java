package com.example.starter_project_2025.system.git_integration.contributor;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;

/**
 * GI-06: keeps the contributor directory of master projects up to date. Two writers may create
 * the same new identity at once: the loser hits the unique key and runs again as an update.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GitContributorRegistry {

    private final GitContributorWriter writer;

    public void record(Long tenantId, Long masterId, ContributorSightings sightings) {
        if (masterId == null || sightings.isEmpty()) return;
        try {
            writer.upsert(tenantId, masterId, sightings.all());
        } catch (DataIntegrityViolationException | ObjectOptimisticLockingFailureException race) {
            log.debug("Contributor upsert of master {} raced; retrying once", masterId);
            writer.upsert(tenantId, masterId, sightings.all());
        }
    }
}
