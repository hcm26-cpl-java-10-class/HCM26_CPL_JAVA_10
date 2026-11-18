package com.example.starter_project_2025.system.exam.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.List;

@Getter
@Setter
public class ExamSimilarityDTO {

    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SimilarityReport {
        private Long examId;
        private String examTitle;
        private int scannedAttemptsCount;
        private int scannedQuestionsCount;
        private int totalPairsCompared;
        private int flaggedPairsCount;
        private boolean aiEvaluated;
        private String aiMessage;
        private Instant scannedAt;
        private List<SimilarPair> pairs;
    }

    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SimilarPair {
        private String pairId;
        private Long questionId;
        private int questionDisplayOrder;
        private String questionContent;
        private Long attemptId1;
        private String studentName1;
        private String studentEmail1;
        private String answerText1;
        private Long attemptId2;
        private String studentName2;
        private String studentEmail2;
        private String answerText2;
        private double lexicalSimilarity;
        private Double semanticSimilarity;
        private double overallSimilarity;
        private String matchType; // "EXACT_MATCH", "HIGH_SIMILARITY", "SUSPICIOUS_PARAPHRASE", "MODERATE_SIMILARITY"
        private String explanation;
        private boolean aiAnalyzed;
    }
}
