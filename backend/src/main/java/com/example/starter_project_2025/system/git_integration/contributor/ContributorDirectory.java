package com.example.starter_project_2025.system.git_integration.contributor;

import com.example.starter_project_2025.system.git_integration.domain.GitContributor;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * GI-06: the contributors of one master project, looked up by the identity of a Git row.
 * A master has a few dozen contributors, so they are read once and resolved in memory.
 * <p>
 * A row resolves by GitHub user id, else by the GitHub login (commits of a push payload carry
 * the login GitHub matched to the commit e-mail, but no id), else by the commit e-mail.
 */
public final class ContributorDirectory {

    public static final ContributorDirectory EMPTY = new ContributorDirectory(List.of());

    private final Map<String, GitContributor> byKey = new HashMap<>();
    private final Map<String, GitContributor> gitHubByLogin = new HashMap<>();

    public ContributorDirectory(Collection<GitContributor> contributors) {
        for (GitContributor contributor : contributors) {
            byKey.put(contributor.getIdentityKey(), contributor);
            if (contributor.isGitHub() && contributor.getLogin() != null) {
                gitHubByLogin.merge(contributor.getLogin().toLowerCase(Locale.ROOT), contributor, ContributorDirectory::latest);
            }
        }
    }

    /** The contributor of a Git row, or null. */
    public GitContributor resolve(Long githubId, String login, String email) {
        if (githubId != null) return byKey.get(ContributorIdentity.githubKey(githubId));
        GitContributor viaLogin = gitHubByLogin(login);
        if (viaLogin != null) return viaLogin;
        String key = ContributorIdentity.key(null, email);
        return key == null ? null : byKey.get(key);
    }

    /** The GitHub contributor currently using {@code login}, or null. */
    public GitContributor gitHubByLogin(String login) {
        if (login == null || login.isBlank()) return null;
        return gitHubByLogin.get(login.trim().toLowerCase(Locale.ROOT));
    }

    public boolean isEmpty() {
        return byKey.isEmpty();
    }

    /** Two GitHub accounts once used the same login (a rename): the most recently seen one owns it. */
    private static GitContributor latest(GitContributor a, GitContributor b) {
        LocalDateTime seenA = a.getLastSeenAt();
        LocalDateTime seenB = b.getLastSeenAt();
        if (seenA == null) return b;
        if (seenB == null) return a;
        return seenB.isAfter(seenA) ? b : a;
    }
}
