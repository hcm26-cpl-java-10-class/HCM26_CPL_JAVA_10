package com.example.starter_project_2025.system.project.milestone.submission;

import com.example.starter_project_2025.system.project.milestone.submission.dto.SubmissionDtos;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class SubmissionSummaryLimitTest {
    @Test void creationAndDraftUpdatesAccept1000CharactersButReject1001() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            for (int length : new int[] {1000, 1001}) {
                var create = new SubmissionDtos.CreateVersionRequest("Delivery", "a".repeat(length), null);
                var update = new SubmissionDtos.UpdateDraftRequest("Delivery", "a".repeat(length), null, null);
                assertThat(validator.validate(create)).hasSize(length == 1000 ? 0 : 1);
                assertThat(validator.validate(update)).hasSize(length == 1000 ? 0 : 1);
            }
        }
    }
}
