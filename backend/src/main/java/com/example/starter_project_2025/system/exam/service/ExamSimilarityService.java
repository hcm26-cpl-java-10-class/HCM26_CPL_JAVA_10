package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptAnswer;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptQuestion;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.dto.ExamSimilarityDTO;
import com.example.starter_project_2025.system.exam.service.ai.AiEssayGradingClient;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@Slf4j
public class ExamSimilarityService {

    private static final Set<ExamAttemptStatus> FINISHED_STATUSES = Set.of(
            ExamAttemptStatus.SUBMITTED,
            ExamAttemptStatus.PENDING_REVIEW,
            ExamAttemptStatus.EXPIRED
    );

    private static final double SUSPICIOUS_LEXICAL_THRESHOLD = 40.0;
    private static final int MAX_AI_EVALUATION_PAIRS = 10;
    private static final Pattern NON_ALPHANUMERIC = Pattern.compile("[^\\p{L}\\p{Nd}]+");

    private final ExamRepository examRepository;
    private final ExamAttemptRepository attemptRepository;
    private final AiEssayGradingClient aiClient;

    public ExamSimilarityDTO.SimilarityReport scanExamSimilarity(Long examId) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found with id: " + examId));

        List<ExamAttempt> attempts = attemptRepository.findFinishedWithQuestionType(
                examId, FINISHED_STATUSES, QuestionType.ESSAY
        );

        ExamSimilarityDTO.SimilarityReport report = new ExamSimilarityDTO.SimilarityReport();
        report.setExamId(exam.getId());
        report.setExamTitle(exam.getTitle());
        report.setScannedAttemptsCount(attempts.size());
        report.setScannedAt(Instant.now());

        if (attempts.size() < 2) {
            report.setScannedQuestionsCount(0);
            report.setTotalPairsCompared(0);
            report.setFlaggedPairsCount(0);
            report.setAiEvaluated(false);
            report.setAiMessage("Not enough submitted attempts to perform similarity comparison (minimum 2 attempts required).");
            report.setPairs(List.of());
            return report;
        }

        // Group essay submissions by source question ID
        Map<Long, List<SubmissionRecord>> submissionsByQuestion = new LinkedHashMap<>();
        Set<Long> uniqueQuestions = new LinkedHashSet<>();

        for (ExamAttempt attempt : attempts) {
            for (ExamAttemptQuestion question : attempt.getQuestions()) {
                if (question.getType() != QuestionType.ESSAY) {
                    continue;
                }
                Long qId = question.getSourceQuestionId();
                uniqueQuestions.add(qId);
                String ansText = findAnswerText(attempt, question);
                if (ansText != null && !ansText.isBlank()) {
                    submissionsByQuestion.computeIfAbsent(qId, k -> new ArrayList<>())
                            .add(new SubmissionRecord(attempt, question, ansText.trim()));
                }
            }
        }

        report.setScannedQuestionsCount(uniqueQuestions.size());

        if (uniqueQuestions.isEmpty()) {
            report.setTotalPairsCompared(0);
            report.setFlaggedPairsCount(0);
            report.setAiEvaluated(false);
            report.setAiMessage("No essay questions found in this exam to compare.");
            report.setPairs(List.of());
            return report;
        }

        List<ExamSimilarityDTO.SimilarPair> flaggedPairs = new ArrayList<>();
        int totalPairsCompared = 0;

        for (Map.Entry<Long, List<SubmissionRecord>> entry : submissionsByQuestion.entrySet()) {
            List<SubmissionRecord> subs = entry.getValue();
            if (subs.size() < 2) {
                continue;
            }

            for (int i = 0; i < subs.size(); i++) {
                SubmissionRecord subA = subs.get(i);
                for (int j = i + 1; j < subs.size(); j++) {
                    SubmissionRecord subB = subs.get(j);
                    if (isSameStudent(subA.attempt().getStudent(), subB.attempt().getStudent())) {
                        continue;
                    }

                    totalPairsCompared++;
                    double lexicalScore = calculateLexicalSimilarity(subA.answerText(), subB.answerText());

                    if (lexicalScore >= SUSPICIOUS_LEXICAL_THRESHOLD) {
                        String pairId = "q" + entry.getKey() + "-att" + subA.attempt().getId() + "-att" + subB.attempt().getId();
                        String matchType = determineInitialMatchType(lexicalScore);
                        String explanation = generateLexicalExplanation(subA.answerText(), subB.answerText(), lexicalScore);

                        ExamSimilarityDTO.SimilarPair pair = ExamSimilarityDTO.SimilarPair.builder()
                                .pairId(pairId)
                                .questionId(entry.getKey())
                                .questionDisplayOrder(subA.question().getDisplayOrder())
                                .questionContent(subA.question().getContent())
                                .attemptId1(subA.attempt().getId())
                                .studentName1(formatStudentName(subA.attempt().getStudent()))
                                .studentEmail1(formatStudentEmail(subA.attempt().getStudent()))
                                .answerText1(subA.answerText())
                                .attemptId2(subB.attempt().getId())
                                .studentName2(formatStudentName(subB.attempt().getStudent()))
                                .studentEmail2(formatStudentEmail(subB.attempt().getStudent()))
                                .answerText2(subB.answerText())
                                .lexicalSimilarity(lexicalScore)
                                .semanticSimilarity(null)
                                .overallSimilarity(lexicalScore)
                                .matchType(matchType)
                                .explanation(explanation)
                                .aiAnalyzed(false)
                                .build();

                        flaggedPairs.add(pair);
                    }
                }
            }
        }

        report.setTotalPairsCompared(totalPairsCompared);
        report.setFlaggedPairsCount(flaggedPairs.size());

        // Sort descending by similarity
        flaggedPairs.sort((a, b) -> Double.compare(b.getOverallSimilarity(), a.getOverallSimilarity()));

        // Stage 2: AI Semantic Analysis for top suspect pairs
        if (!flaggedPairs.isEmpty() && aiClient.isConfigured()) {
            List<ExamSimilarityDTO.SimilarPair> topPairs = flaggedPairs.stream()
                    .limit(MAX_AI_EVALUATION_PAIRS)
                    .toList();

            List<AiEssayGradingClient.SimilarityRequestItem> requestItems = topPairs.stream()
                    .map(p -> new AiEssayGradingClient.SimilarityRequestItem(
                            p.getPairId(),
                            p.getQuestionId(),
                            p.getQuestionContent(),
                            p.getStudentName1(),
                            p.getAnswerText1(),
                            p.getStudentName2(),
                            p.getAnswerText2(),
                            p.getLexicalSimilarity()
                    ))
                    .toList();

            try {
                List<AiEssayGradingClient.SimilarityEvaluationResult> aiResults = aiClient.evaluateSimilarityBatch(requestItems);
                Map<String, AiEssayGradingClient.SimilarityEvaluationResult> resultMap = aiResults.stream()
                        .collect(Collectors.toMap(AiEssayGradingClient.SimilarityEvaluationResult::pairId, r -> r, (a, b) -> a));

                for (ExamSimilarityDTO.SimilarPair pair : topPairs) {
                    AiEssayGradingClient.SimilarityEvaluationResult aiRes = resultMap.get(pair.getPairId());
                    if (aiRes != null) {
                        pair.setSemanticSimilarity(aiRes.semanticSimilarity());
                        if (aiRes.matchType() != null && !aiRes.matchType().isBlank()) {
                            pair.setMatchType(aiRes.matchType());
                        }
                        if (aiRes.explanation() != null && !aiRes.explanation().isBlank()) {
                            pair.setExplanation(aiRes.explanation());
                        }
                        pair.setOverallSimilarity(Math.max(pair.getLexicalSimilarity(), aiRes.semanticSimilarity()));
                        pair.setAiAnalyzed(true);
                    }
                }

                // Re-sort with updated overallSimilarity
                flaggedPairs.sort((a, b) -> Double.compare(b.getOverallSimilarity(), a.getOverallSimilarity()));
                report.setAiEvaluated(true);
                report.setAiMessage("AI semantic analysis completed by Google Gemini (" + aiClient.getModel() + "). Top "
                        + topPairs.size() + " suspicious pairs evaluated.");

            } catch (Exception e) {
                log.warn("Gemini AI similarity evaluation encountered an error, falling back to lexical similarity: {}", e.getMessage());
                report.setAiEvaluated(false);
                report.setAiMessage("Lexical similarity analysis only (Google Gemini AI evaluation unavailable: " + e.getMessage() + ").");
            }
        } else if (!aiClient.isConfigured()) {
            report.setAiEvaluated(false);
            report.setAiMessage("Lexical similarity analysis only (Google Gemini API key not configured or AI disabled).");
        } else {
            report.setAiEvaluated(true);
            report.setAiMessage("No suspicious essay pairs detected above threshold (" + SUSPICIOUS_LEXICAL_THRESHOLD + "%).");
        }

        report.setPairs(flaggedPairs);
        return report;
    }

    public double calculateLexicalSimilarity(String textA, String textB) {
        if (textA == null || textB == null) return 0.0;
        String normA = normalizeText(textA);
        String normB = normalizeText(textB);
        if (normA.isBlank() || normB.isBlank()) return 0.0;

        String[] tokensA = normA.split("\\s+");
        String[] tokensB = normB.split("\\s+");
        if (tokensA.length < 5 || tokensB.length < 5) return 0.0;

        if (normA.equals(normB)) return 100.0;

        Set<String> setA = new HashSet<>(Arrays.asList(tokensA));
        Set<String> setB = new HashSet<>(Arrays.asList(tokensB));

        Set<String> intersection = new HashSet<>(setA);
        intersection.retainAll(setB);

        Set<String> union = new HashSet<>(setA);
        union.addAll(setB);

        double jaccardToken = union.isEmpty() ? 0.0 : ((double) intersection.size() / union.size());

        Set<String> bigramsA = generateBigrams(tokensA);
        Set<String> bigramsB = generateBigrams(tokensB);

        double jaccardBigram = 0.0;
        if (!bigramsA.isEmpty() && !bigramsB.isEmpty()) {
            Set<String> biIntersection = new HashSet<>(bigramsA);
            biIntersection.retainAll(bigramsB);
            Set<String> biUnion = new HashSet<>(bigramsA);
            biUnion.addAll(bigramsB);
            jaccardBigram = ((double) biIntersection.size() / biUnion.size());
        }

        double combined = (!bigramsA.isEmpty() && !bigramsB.isEmpty())
                ? (0.6 * jaccardToken + 0.4 * jaccardBigram)
                : jaccardToken;

        double finalScore = Math.max(combined, jaccardToken);
        return Math.round(finalScore * 1000.0) / 10.0;
    }

    private String normalizeText(String text) {
        return NON_ALPHANUMERIC.matcher(text.toLowerCase(Locale.ROOT)).replaceAll(" ").trim();
    }

    private Set<String> generateBigrams(String[] tokens) {
        Set<String> bigrams = new HashSet<>();
        for (int i = 0; i < tokens.length - 1; i++) {
            bigrams.add(tokens[i] + " " + tokens[i + 1]);
        }
        return bigrams;
    }

    private String determineInitialMatchType(double score) {
        if (score >= 90.0) return "EXACT_MATCH";
        if (score >= 70.0) return "HIGH_SIMILARITY";
        if (score >= 50.0) return "SUSPICIOUS_PARAPHRASE";
        return "MODERATE_SIMILARITY";
    }

    private String generateLexicalExplanation(String textA, String textB, double score) {
        String normA = normalizeText(textA);
        String normB = normalizeText(textB);
        String[] tokensA = normA.split("\\s+");
        String[] tokensB = normB.split("\\s+");

        Set<String> setA = new HashSet<>(Arrays.asList(tokensA));
        Set<String> setB = new HashSet<>(Arrays.asList(tokensB));
        Set<String> common = new HashSet<>(setA);
        common.retainAll(setB);

        String sampleTerms = common.stream()
                .filter(w -> w.length() > 3)
                .limit(5)
                .collect(Collectors.joining(", "));

        if (score >= 90.0) {
            return "High verbatim text match (" + score + "% overlap). Identical phrasing patterns detected.";
        } else if (score >= 70.0) {
            return "High vocabulary overlap (" + score + "%). Shared key terminology: [" + sampleTerms + "].";
        } else {
            return "Moderate lexical overlap (" + score + "%). Shared terms: [" + sampleTerms + "]. Potential paraphrasing indicators.";
        }
    }

    private boolean isSameStudent(User a, User b) {
        if (a == null || b == null) return false;
        return Objects.equals(a.getId(), b.getId());
    }

    private String formatStudentName(User student) {
        if (student == null) return "Anonymous Student";
        String last = student.getLastName() == null ? "" : student.getLastName().trim();
        return (student.getFirstName() + " " + last).trim();
    }

    private String formatStudentEmail(User student) {
        return student != null && student.getEmail() != null ? student.getEmail() : "—";
    }

    private String findAnswerText(ExamAttempt attempt, ExamAttemptQuestion question) {
        return attempt.getAnswers().stream()
                .filter(a -> a.getQuestion().getId().equals(question.getId()))
                .map(ExamAttemptAnswer::getTextAnswer)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse("");
    }

    private record SubmissionRecord(
            ExamAttempt attempt,
            ExamAttemptQuestion question,
            String answerText
    ) {}
}
