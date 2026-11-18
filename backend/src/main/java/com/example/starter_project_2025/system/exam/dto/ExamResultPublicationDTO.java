package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.system.exam.domain.ScoreReleasePolicy;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
public class ExamResultPublicationDTO {

    private Long examId;

    private ScoreReleasePolicy releasePolicy;

    private boolean published;

    private LocalDateTime publishedAt;

    private Long publishedBy;

    private LocalDateTime unpublishedAt;

    private Long unpublishedBy;
}