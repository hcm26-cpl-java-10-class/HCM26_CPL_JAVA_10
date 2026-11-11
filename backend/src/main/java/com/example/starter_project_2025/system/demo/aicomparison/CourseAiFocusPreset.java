package com.example.starter_project_2025.system.demo.aicomparison;

import com.example.starter_project_2025.exception.BadRequestException;

import java.util.Arrays;

/**
 * Danh sách "focus" có sẵn cho AI so sánh khóa học.
 *
 * <p>Người dùng chỉ được chọn một {@code key} trong danh sách này; backend tự đổi key thành câu
 * hướng dẫn cố định ({@link #instruction}). Nhờ vậy không có văn bản tự do nào của người dùng
 * đi vào prompt (chặn prompt injection / nội dung không phù hợp).
 */
public enum CourseAiFocusPreset {

    COMPLETION("completion",
            "Focus on completion and drop-off: where learners stop (funnel module). "
                    + "Give the most detail on the funnel metrics."),
    TREND("trend",
            "Focus on how enrollments and progress change over time (trend module)."),
    ACTIVITY("activity",
            "Focus on learner activity and engagement (activity module): how active the learners are."),
    RATING("rating",
            "Focus on ratings and reviews (reviews module): explain why the rating is high or low."),
    DEPARTMENTS("departments",
            "Focus on differences between departments (departments module): which departments do best or worst."),
    RANKING("ranking",
            "Focus on the ranking of the target course among its peers (ranking module) and what drives it."),
    CONTENT("content",
            "Focus on the learning content (content module): lessons, content types and coverage."),
    STUDY_TIME("study-time",
            "Focus on study time (study-time module): how much time learners spend compared with peers.");

    private final String key;
    private final String instruction;

    CourseAiFocusPreset(String key, String instruction) {
        this.key = key;
        this.instruction = instruction;
    }

    public String key() {
        return key;
    }

    public String instruction() {
        return instruction;
    }

    /**
     * Đổi key do client gửi thành câu hướng dẫn.
     *
     * @return chuỗi rỗng nếu key trống (= phân tích tất cả module)
     * @throws BadRequestException nếu key không nằm trong danh sách
     */
    public static String resolve(String key) {
        if (key == null || key.isBlank()) {
            return "";
        }
        String wanted = key.trim();
        return Arrays.stream(values())
                .filter(preset -> preset.key.equalsIgnoreCase(wanted))
                .findFirst()
                .map(CourseAiFocusPreset::instruction)
                .orElseThrow(() -> new BadRequestException("Unsupported AI focus option."));
    }
}
