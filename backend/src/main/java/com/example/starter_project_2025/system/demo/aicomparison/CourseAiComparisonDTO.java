package com.example.starter_project_2025.system.demo.aicomparison;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

/**
 * Request/response cho phân tích AI so sánh 1 khóa học mục tiêu với N khóa học khác.
 *
 * <p>Nguyên tắc: <b>backend tính toàn bộ số liệu</b> (rank, median, percentile, gap),
 * AI chỉ diễn giải bằng chữ. Vì vậy request rất mỏng và response trả về JSON
 * do AI sinh ra (đã được backend kiểm tra lại).
 */
public final class CourseAiComparisonDTO {

    private CourseAiComparisonDTO() {
    }

    /**
     * Yêu cầu phân tích so sánh.
     *
     * @param targetCourseId khóa học mục tiêu
     * @param peerCourseIds   các khóa học đối chiếu; để trống thì backend tự chọn
     *                       (cùng category/level, tối đa 15 khóa)
     * @param focus           câu hỏi/tham chiếu của người dùng (VD: "retention")
     * @param language        "en" | "vi"
     */
    public record AiCompareRequest(
            @NotNull Long targetCourseId,
            @Size(max = 30) List<Long> peerCourseIds,
            LocalDate from,
            LocalDate to,
            @Size(max = 400) String focus,
            String language
    ) {
    }

    /** Kết quả phân tích: JSON do AI sinh + thông tin về bộ dữ liệu đã dùng. */
    public record AiCompareResponse(
            Long targetCourseId,
            String targetCourseName,
            List<Long> peerCourseIds,
            int peerCount,
            /** true nghĩa là danh sách peer bị cắt bớt do giới hạn 15 khóa. */
            boolean peersTruncated,
            /** true nghĩa là peer được backend tự chọn (user không chỉ định). */
            boolean peersAutoSelected,
            /** Phân tích do AI sinh (đã được backend kiểm tra và chuẩn hoá). */
            JsonNode analysis
    ) {
    }

    /** Câu hỏi tiếp theo về kết quả so sánh (multi-turn). */
    public record AiFollowUpRequest(
            @NotNull Long targetCourseId,
            @Size(max = 30) List<Long> peerCourseIds,
            LocalDate from,
            LocalDate to,
            @Size(max = 2000) String question,
            /** Lịch sử hội thoại trước đó (role = "user" | "assistant"). */
            @Size(max = 20) List<AiTurn> history,
            String language
    ) {
    }

    public record AiTurn(String role, String content) {
    }

    public record AiFollowUpResponse(JsonNode answer) {
    }

    /** So sánh cấu trúc nội dung (outline) của các khóa học. */
    public record AiOutlineRequest(
            @NotNull Long targetCourseId,
            @Size(max = 30) List<Long> peerCourseIds,
            @Size(max = 400) String focus,
            String language
    ) {
    }

    public record AiOutlineResponse(
            Long targetCourseId,
            String targetCourseName,
            List<Long> peerCourseIds,
            JsonNode analysis
    ) {
    }

    /** Tóm tắt ngắn từ kết quả phân tích đã có. */
    public record AiSummaryRequest(
            @NotNull JsonNode analysis,
            String language
    ) {
    }

    public record AiSummaryResponse(JsonNode summary) {
    }
}
