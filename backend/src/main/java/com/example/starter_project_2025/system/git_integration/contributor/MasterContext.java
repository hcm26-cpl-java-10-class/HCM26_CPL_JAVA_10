package com.example.starter_project_2025.system.git_integration.contributor;

import com.example.starter_project_2025.system.git_integration.dto.GitLinkDetails;

import java.util.List;
import java.util.Optional;
import java.util.Set;

/** GI-06: the master project a request acts on (a module resolves to its master) and its members. */
record MasterContext(Long tenantId, Long masterId, GitLinkDetails.ProjectSummary summary, Set<Long> scope,
                     List<GitProjectMembership.Member> members, boolean canView, boolean canManage) {

    Optional<GitProjectMembership.Member> member(Long userId) {
        return members.stream().filter(member -> member.userId().equals(userId)).findFirst();
    }

    boolean isMember(Long userId) {
        return member(userId).isPresent();
    }
}
