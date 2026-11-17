package com.example.starter_project_2025.system.project.sprint_backlog.key;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TaskKeyFormatTest {

    @Test
    void formatsPrefixAndNumberWithoutPadding() {
        assertThat(TaskKeyFormat.format("FA", 1)).isEqualTo("FA-1");
        assertThat(TaskKeyFormat.format("WEB2", 120)).isEqualTo("WEB2-120");
        assertThatThrownBy(() -> TaskKeyFormat.format("fa", 1)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> TaskKeyFormat.format("FA", 0)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void parsesKeysCaseInsensitively() {
        assertThat(TaskKeyFormat.parse(" fa-12 ")).hasValueSatisfying(key -> {
            assertThat(key.prefix()).isEqualTo("FA");
            assertThat(key.number()).isEqualTo(12);
            assertThat(key.key()).isEqualTo("FA-12");
        });
        assertThat(TaskKeyFormat.parse("ABCDEFGH-1")).isPresent();
    }

    @Test
    void rejectsTextThatIsNotATaskKey() {
        assertThat(TaskKeyFormat.parse("FA-01")).isEmpty();
        assertThat(TaskKeyFormat.parse("FA-0")).isEmpty();
        assertThat(TaskKeyFormat.parse("FA12")).isEmpty();
        assertThat(TaskKeyFormat.parse("#12")).isEmpty();
        assertThat(TaskKeyFormat.parse("ABCDEFGHI-1")).isEmpty();
        assertThat(TaskKeyFormat.parse("TEAM-12-345")).isEmpty();
        assertThat(TaskKeyFormat.parse(null)).isEmpty();
    }

    @Test
    void invalidOrMissingPrefixFallsBackToTheDefault() {
        assertThat(TaskKeyFormat.prefixOrDefault(" web ")).isEqualTo("WEB");
        assertThat(TaskKeyFormat.prefixOrDefault(null)).isEqualTo("FA");
        assertThat(TaskKeyFormat.prefixOrDefault("TOO-LONG-PREFIX")).isEqualTo("FA");
    }

    @Test
    void acronymMatchesWhatTheFrontendDisplayed() {
        assertThat(TaskKeyFormat.acronym("Student Support Portal")).hasValue("SSP");
        assertThat(TaskKeyFormat.acronym("Project A")).hasValue("PA");
        assertThat(TaskKeyFormat.acronym("Sprint 2024 board")).hasValue("SB");
        assertThat(TaskKeyFormat.acronym("Portal")).isEmpty();
        assertThat(TaskKeyFormat.acronym("A b c d e f g h i")).isEmpty();
        assertThat(TaskKeyFormat.acronym(null)).isEmpty();
    }
}
