package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.system.exam.domain.IntegrityReviewStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/** NEW (anti-cheat nang cao) */
@Getter @Setter
public class IntegrityReviewRequest {
    @NotNull
    private IntegrityReviewStatus status;

    @Size(max = 1000)
    private String note;
}
