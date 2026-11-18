package com.example.starter_project_2025.system.git_integration.tasklink;

import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceField;
import com.example.starter_project_2025.system.git_integration.domain.GitArtifactType;
import com.example.starter_project_2025.system.git_integration.repository.BacklogReferenceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * TM-03 one-off clean-up: SY-05 also read Task IDs from the branch name of a pull request.
 * Each pull request that still has such a reference is mapped again from its title and
 * description, which removes the branch references and their AUTO links (MANUAL links stay).
 * Idempotent: nothing is left to do on the next start.
 */
@Slf4j
@Component
@Order(10)
@RequiredArgsConstructor
public class PullRequestBranchRefCleanup implements CommandLineRunner {

    private final BacklogReferenceRepository references;
    private final GitTaskLinker linker;

    @Override
    public void run(String... args) {
        List<Long> ids = cleanUp();
        if (!ids.isEmpty()) log.info("Task links: mapped {} pull request(s) again without their branch name", ids.size());
    }

    /** Maps again every pull request with a branch reference; returns their ids. */
    public List<Long> cleanUp() {
        List<Long> ids = references.findSourceIdsByField(GitArtifactType.PULL_REQUEST, BacklogReferenceField.BRANCH);
        for (Long id : ids) {
            try {
                linker.linkPullRequest(id);
            } catch (RuntimeException failure) {
                log.warn("Task links: pull request {} could not be mapped again; retried on next start", id, failure);
            }
        }
        return ids;
    }
}
