package com.example.starter_project_2025.system.project.milestone.submission.service;

import com.example.starter_project_2025.system.project.milestone.exception.MilestoneValidationException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ReleaseNotesWordLimitTest {
    @Test
    void acceptsExactlyOneThousandWhitespaceSeparatedWords() {
        String note = "word ".repeat(ReleaseNotesWordLimit.MAX_WORDS).trim();

        assertThat(ReleaseNotesWordLimit.count(note)).isEqualTo(1_000);
        ReleaseNotesWordLimit.validate(note);
    }

    @Test
    void rejectsOneThousandAndOneWords() {
        String note = "word ".repeat(ReleaseNotesWordLimit.MAX_WORDS + 1).trim();

        assertThatThrownBy(() -> ReleaseNotesWordLimit.validate(note))
                .isInstanceOf(MilestoneValidationException.class);
    }

    @Test
    void countsUnicodeWhitespaceAndEmptyTextConsistently() {
        assertThat(ReleaseNotesWordLimit.count("  đầu\t\n tiếp\u2003theo  ")).isEqualTo(3);
        assertThat(ReleaseNotesWordLimit.count(" \t\n ")).isZero();
    }
}
