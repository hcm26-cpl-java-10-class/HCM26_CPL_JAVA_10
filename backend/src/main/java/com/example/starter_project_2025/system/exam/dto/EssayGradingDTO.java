package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.List;

@Getter
@Setter
public class EssayGradingDTO {

    @Getter
    @Setter
    public static class Summary {
        private Long attemptId;
        private Long studentId;
        private String studentName;
        private String studentEmail;
        private int attemptNumber;
        private ExamAttemptStatus status;
        private Instant submittedAt;
        private int essayCount;
        private int essayAnswered;
    }
    @Getter
    @Setter
    public static class Detail {
        private Long attemptId;
        private Long examId;
        private String examTitle;
        private Long studentId;
        private String studentName;
        private String studentEmail;
        private int attemptNumber;
        private ExamAttemptStatus status;
        private Instant startedAt;
        private Instant submittedAt;
        private int totalPoints;
        private Integer objectiveScore;
        private List<EssayItem> essays;
    }

    @Getter
    @Setter
    public static class EssayItem {
        private Long questionId;
        private int displayOrder;
        private String content;
        private int points;
        private String answerText;
    }
}
