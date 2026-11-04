package com.example.starter_project_2025.system.project.workspace.git;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class GitRepositoryValidatorTest {
    private final GitRepositoryValidator validator = new GitRepositoryValidator();
    private GitConfigDtos.Save input(String url, String branch) { return new GitConfigDtos.Save(0L, url, branch, null); }

    @ParameterizedTest @CsvSource({
        "https://github.com/team/repo.git,https://github.com/team/repo,GITHUB",
        "https://github.com/team/repo,https://github.com/team/repo,GITHUB",
        "git@github.com:team/repo.git,https://github.com/team/repo,GITHUB",
        "ssh://git@github.com/team/repo.git,https://github.com/team/repo,GITHUB",
        "https://gitlab.com/group/subgroup/repo.git,https://gitlab.com/group/subgroup/repo,GITLAB",
        "git@gitlab.com:group/subgroup/repo.git,https://gitlab.com/group/subgroup/repo,GITLAB",
        "git@bitbucket.org:team/repo.git,https://bitbucket.org/team/repo,BITBUCKET",
        "https://dev.azure.com/org/project/_git/repo,https://dev.azure.com/org/project/_git/repo,AZURE_DEVOPS",
        "git@ssh.dev.azure.com:v3/org/project/repo,https://dev.azure.com/org/project/_git/repo,AZURE_DEVOPS",
        "https://org.visualstudio.com/project/_git/repo,https://org.visualstudio.com/project/_git/repo,AZURE_DEVOPS",
        "https://git.company.test/group/repo.git,https://git.company.test/group/repo,SELF_HOSTED"
    })
    void mapsSupportedCloneUrlsToSafeRepositoryPages(String clone, String web, String provider) {
        var result = validator.validate(input(clone, "feature/login"));
        assertThat(result.webUrl()).isEqualTo(web);
        assertThat(result.provider()).isEqualTo(provider);
        assertThat(result.branch()).isEqualTo("feature/login");
    }
    @ParameterizedTest @ValueSource(strings = {"", "hello", "https://youtube.com/watch?v=123", "http://github.com/a/b",
        "https://github.com/a", "https://github.com/a/b/tree/main", "javascript:alert(1)", "file:///tmp/repo.git",
        "https://user:secret@github.com/a/b.git", "https://token@github.com/a/b.git", "https://github.com/a/b.git?token=secret",
        "git@github.com:a/b.git#secret", "ssh://root@github.com/a/b.git", "ssh://git:secret@github.com/a/b.git",
        "https://github.com/a/%2e%2e/b.git", "https://github.com/a/b%0a.git", "git@github.com:a/b.git\nsecret",
        "-----BEGIN OPENSSH PRIVATE KEY-----", "https://example.com/about", "https://github.com/a/b.git?", "https://github.com/a/b.git#"})
    void rejectsMalformedNonRepositoryAndCredentialBearingInputs(String url) {
        assertThatThrownBy(() -> validator.validate(input(url, "main"))).isInstanceOf(GitConfigValidationException.class);
    }
    @ParameterizedTest @ValueSource(strings = {"", "a b", "a..b", "a@{b", "-bad", "/bad", "bad/", "bad.", "a//b", "a/.hidden", "a.lock", "a/b.lock", "a\\b", "a:b", "a~b", "a?b", "@", "a\nb"})
    void rejectsInvalidBranchNames(String branch) {
        assertThatThrownBy(() -> validator.validate(input("https://github.com/a/b", branch)))
                .isInstanceOf(GitConfigValidationException.class).hasMessageContaining("branch");
    }
    @Test void selfHostedSshNeedsAnExplicitSafeWebUrl() {
        assertThatThrownBy(() -> validator.validate(input("ssh://git@ssh.company.test:2222/team/repo.git", "main")))
                .isInstanceOf(GitConfigValidationException.class).hasMessageContaining("HTTPS repository page");
        assertThat(validator.validate(new GitConfigDtos.Save(0L, "git@ssh.company.test:team/repo.git", "main", "https://git.company.test/team/repo")).webUrl())
                .isEqualTo("https://git.company.test/team/repo");
        assertThatThrownBy(() -> validator.validate(new GitConfigDtos.Save(0L, "git@ssh.company.test:team/repo.git", "main", "https://secret@git.company.test/team/repo")))
                .isInstanceOf(GitConfigValidationException.class);
    }
    @Test void requestToStringCannotExposeSecretsBeforeValidation() {
        var request = new GitConfigDtos.Save(0L, "https://user:secret@github.com/a/b", "secret", "https://token@example.com/repo");
        assertThat(request.toString()).doesNotContain("secret", "token", "github.com", "example.com");
    }
}
