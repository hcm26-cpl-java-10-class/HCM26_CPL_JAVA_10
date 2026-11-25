package com.example.starter_project_2025.system.git_integration.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/** SY-07: the {@code sync-branch-exclude} globs. */
class GitBranchWriterGlobTest {

    @Test
    void doubleStarCrossesSegmentsSingleStarDoesNot() {
        List<Pattern> globs = GitBranchWriter.globs(List.of("dependabot/**", "renovate/*", "tmp-?", " "));

        assertThat(matches(globs, "dependabot/npm_and_yarn/lodash-4.17.21")).isTrue();
        assertThat(matches(globs, "renovate/react")).isTrue();
        assertThat(matches(globs, "renovate/npm/react")).isFalse();
        assertThat(matches(globs, "tmp-1")).isTrue();
        assertThat(matches(globs, "tmp-12")).isFalse();
        assertThat(matches(globs, "feature/cart")).isFalse();
    }

    @Test
    void regexCharactersInAGlobAreLiteral() {
        List<Pattern> globs = GitBranchWriter.globs(List.of("release/1.0+hotfix"));

        assertThat(matches(globs, "release/1.0+hotfix")).isTrue();
        assertThat(matches(globs, "release/1x0hotfix")).isFalse();
    }

    @Test
    void noGlobsExcludeNothing() {
        assertThat(GitBranchWriter.globs(null)).isEmpty();
    }

    private static boolean matches(List<Pattern> globs, String name) {
        return globs.stream().anyMatch(glob -> glob.matcher(name).matches());
    }
}
