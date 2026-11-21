package com.example.starter_project_2025.system.git_integration.contributor;

import com.example.starter_project_2025.system.git_integration.contributor.ContributorSightings.Sighting;
import com.example.starter_project_2025.system.git_integration.domain.GitContributor;
import com.example.starter_project_2025.system.git_integration.repository.GitContributorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;

/** GI-06: creates or refreshes the contributor rows of one master project, in its own transaction. */
@Component
@RequiredArgsConstructor
class GitContributorWriter {

    private final GitContributorRepository contributors;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void upsert(Long tenantId, Long masterId, Collection<Sighting> sightings) {
        for (Sighting seen : sightings) {
            GitContributor row = contributors.findByMasterProjectIdAndIdentityKey(masterId, seen.key())
                    .orElseGet(() -> GitContributor.builder()
                            .tenantId(tenantId)
                            .masterProjectId(masterId)
                            .identityKey(seen.key())
                            .externalUserId(seen.githubId())
                            .email(seen.email())
                            .build());
            boolean newer = ContributorSightings.isAfterOrSame(seen.lastAt(), row.getLastSeenAt());
            if (seen.login() != null && (newer || row.getLogin() == null)) row.setLogin(seen.login());
            if (seen.name() != null && (newer || row.getDisplayName() == null)) row.setDisplayName(seen.name());
            row.setFirstSeenAt(ContributorSightings.earliest(row.getFirstSeenAt(), seen.firstAt()));
            row.setLastSeenAt(ContributorSightings.latest(row.getLastSeenAt(), seen.lastAt()));
            contributors.saveAndFlush(row);
        }
    }
}
