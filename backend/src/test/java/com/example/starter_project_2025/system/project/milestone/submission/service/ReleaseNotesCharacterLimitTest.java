package com.example.starter_project_2025.system.project.milestone.submission.service;
import com.example.starter_project_2025.system.project.milestone.exception.MilestoneValidationException;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
class ReleaseNotesCharacterLimitTest {
    @Test void acceptsExactlyOneThousandCharacters() { ReleaseNotesCharacterLimit.validate("a".repeat(1000)); }
    @Test void rejectsOneThousandAndOneCharactersEvenWithoutSpaces() {
        assertThatThrownBy(() -> ReleaseNotesCharacterLimit.validate("a".repeat(1001))).isInstanceOf(MilestoneValidationException.class);
    }
    @Test void countsWhitespaceNewlinesAndSurrogatePairsLikeTheFrontend() {
        assertThat(ReleaseNotesCharacterLimit.count(" a\n\uD83D\uDE00")).isEqualTo(5);
        assertThat(ReleaseNotesCharacterLimit.count(null)).isZero();
        ReleaseNotesCharacterLimit.validate("\uD83D\uDE00".repeat(500));
        assertThatThrownBy(() -> ReleaseNotesCharacterLimit.validate("\uD83D\uDE00".repeat(501))).isInstanceOf(MilestoneValidationException.class);
    }
}
