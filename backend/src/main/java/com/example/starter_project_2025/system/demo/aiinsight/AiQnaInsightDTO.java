package com.example.starter_project_2025.system.demo.aiinsight;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Models for "where students get stuck" (AI analysis of lesson Q&A). */
public final class AiQnaInsightDTO {

    private AiQnaInsightDTO() {
    }

    /** One student question. No author information is ever included. */
    public record QuestionSnippet(Long id, String content, int upvotes, boolean answered) {
    }

    /** A group of questions about the same concept. Counts are computed by code, not by the AI. */
    public record TopicInsight(
            String topic,
            String misunderstanding,
            String suggestion,
            int questionCount,
            int unansweredCount,
            int upvotes,
            List<QuestionSnippet> questions
    ) {
    }

    /** severity = HIGH | MEDIUM | LOW (computed from the counts of all questions of the lesson). */
    public record LessonInsight(
            Long lessonId,
            String lessonTitle,
            Long sectionId,
            String sectionTitle,
            String contentType,
            String severity,
            int questionCount,
            int unansweredCount,
            int upvotes,
            List<TopicInsight> topics
    ) {
    }

    public record CourseInsightResponse(
            Long courseId,
            String courseName,
            int totalQuestions,
            int lessonsAnalyzed,
            List<LessonInsight> lessons,
            String generatedAt,
            boolean cached,
            String note
    ) {
    }

    // ---------- chat with charts ----------

    public record ChatMsg(
            @NotBlank String role,
            @NotBlank @Size(max = 2000) String content
    ) {
    }

    /** language = "en" | "vi" | null (answer in the language of the instructor's message). */
    public record InsightChatRequest(
            @NotEmpty @Size(max = 12) List<@Valid ChatMsg> messages,
            String language
    ) {
    }

    /** value = count; percent = share in percent (0-100, one decimal), both calculated by the system. */
    public record ChartItem(String label, int value, double percent, String detail, Long lessonId) {
    }

    /** type = DONUT | BAR. key tells the screen which visual it is. */
    public record Chart(String key, String type, String title, String subtitle, List<ChartItem> items) {
    }

    /** reply = answer text; charts = visuals; report = per-lesson "stuck" report (only when asked); suggestions = follow-up questions. */
    public record InsightChatResponse(String reply, List<Chart> charts, CourseInsightResponse report, List<String> suggestions) {
    }

    /**
     * Extra explanation for a lesson topic. save = false: only write a draft.
     * save = true with text: append that (possibly edited) text to the lesson.
     */
    public record SupplementRequest(
            @NotBlank @Size(max = 200) String topic,
            @Size(max = 600) String misunderstanding,
            @Size(max = 800) String suggestion,
            Boolean save,
            @Size(max = 5000) String text,
            String language
    ) {
    }

    public record SupplementResponse(Long lessonId, String text, boolean saved) {
    }
}