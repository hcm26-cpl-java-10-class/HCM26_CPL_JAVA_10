package com.example.starter_project_2025.system.project.sprint_backlog;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class SprintBacklogDescriptionLimitTest {
    @Test void importsAcceptOneThousandCharactersAndRejectOneThousandAndOne() {
        var accepted = new SprintBacklog();
        accepted.setTitle("Import boundary"); accepted.setDescription("a".repeat(1000));
        assertThatCode(accepted::prepareForImport).doesNotThrowAnyException();
        assertThat(accepted.getDescription()).hasSize(1000);
        var rejected = new SprintBacklog();
        rejected.setTitle("Import boundary"); rejected.setDescription("a".repeat(1001));
        assertThatThrownBy(rejected::prepareForImport).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("1000");
    }
}
