package com.example.starter_project_2025.system.git_integration.tasklink;

import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceField;
import com.example.starter_project_2025.system.git_integration.tasklink.TaskKeyParser.Mention;
import com.example.starter_project_2025.system.git_integration.tasklink.TaskKeyParser.Source;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

class TaskKeyParserTest {

    private static final Set<String> PREFIXES = Set.of("FA", "WEB");

    private static List<String> keys(String text) {
        return TaskKeyParser.parse(text, BacklogReferenceField.MESSAGE, PREFIXES).stream().map(Mention::key).toList();
    }

    @Test
    void findsTaskIdsInTheUsualCommitStyles() {
        assertThat(keys("FA-21: add cart")).containsExactly("FA-21");
        assertThat(keys("[FA-21] add cart")).containsExactly("FA-21");
        assertThat(keys("(fa-21) add cart")).containsExactly("FA-21");
        assertThat(keys("fixes FA-21, FA-22 and WEB-3")).containsExactly("FA-21", "FA-22", "WEB-3");
        assertThat(keys("Merge pull request #5 from org/feature/FA-21-cart")).containsExactly("FA-21");
        assertThat(keys("feat-FA-7-header")).containsExactly("FA-7");
    }

    @Test
    void ignoresWhatOnlyLooksLikeATaskId() {
        assertThat(keys("bump UTF-8, SHA-256 and ISO-8601 handling")).isEmpty();
        assertThat(keys("see #21 and issue 21")).isEmpty();
        assertThat(keys("FA21 FA-0 FA-012")).isEmpty();
        assertThat(keys("XFA-21 FA-21x")).isEmpty();
        assertThat(keys(null)).isEmpty();
    }

    @Test
    void removesDuplicatesAndCapsTheNumberOfKeys() {
        assertThat(keys("FA-1 fa-1 FA-1")).containsExactly("FA-1");
        String many = String.join(" ", IntStream.rangeClosed(1, 30).mapToObj(i -> "FA-" + i).toList());
        assertThat(keys(many)).hasSize(TaskKeyParser.MAX_KEYS).startsWith("FA-1");
    }

    @Test
    void theFirstFieldMentioningAKeyWins() {
        List<Mention> found = TaskKeyParser.parseAll(List.of(
                new Source(BacklogReferenceField.TITLE, "Cart FA-2"),
                new Source(BacklogReferenceField.BODY, "Closes FA-1 and FA-2")), PREFIXES);

        assertThat(found).extracting(Mention::key).containsExactly("FA-2", "FA-1");
        assertThat(found).extracting(Mention::field)
                .containsExactly(BacklogReferenceField.TITLE, BacklogReferenceField.BODY);
    }

    @Test
    void findsTaskIdsInMarkdownDescriptions() {
        assertThat(keys("Closes **FA-21**, see [FA-22](https://x.test/FA-22) and `FA-23`\n- [ ] FA-24")).containsExactly(
                "FA-21", "FA-22", "FA-23", "FA-24");
    }

    @Test
    void onlyTheStartOfALongDescriptionIsScanned() {
        String body = "x".repeat(TaskKeyParser.MAX_SCAN_LENGTH) + " FA-99";
        assertThat(keys("FA-1 " + body)).containsExactly("FA-1");
    }

    @Test
    void nothingIsATaskIdWhenTheTenantHasNoPrefixYet() {
        assertThat(TaskKeyParser.parse("FA-21", BacklogReferenceField.MESSAGE, Set.of())).isEmpty();
    }
}
