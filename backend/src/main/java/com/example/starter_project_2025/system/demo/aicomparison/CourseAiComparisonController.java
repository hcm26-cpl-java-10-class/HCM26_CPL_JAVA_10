package com.example.starter_project_2025.system.demo.aicomparison;

import com.example.starter_project_2025.system.demo.aicomparison.CourseAiComparisonDTO.AiCompareRequest;
import com.example.starter_project_2025.system.demo.aicomparison.CourseAiComparisonDTO.AiCompareResponse;
import com.example.starter_project_2025.system.demo.aicomparison.CourseAiComparisonDTO.AiFollowUpRequest;
import com.example.starter_project_2025.system.demo.aicomparison.CourseAiComparisonDTO.AiFollowUpResponse;
import com.example.starter_project_2025.system.demo.aicomparison.CourseAiComparisonDTO.AiOutlineRequest;
import com.example.starter_project_2025.system.demo.aicomparison.CourseAiComparisonDTO.AiOutlineResponse;
import com.example.starter_project_2025.system.demo.aicomparison.CourseAiComparisonDTO.AiSummaryRequest;
import com.example.starter_project_2025.system.demo.aicomparison.CourseAiComparisonDTO.AiSummaryResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * AI so sánh khóa học.
 *
 * <p>Đặt cạnh {@code GET /api/reports/course-comparison}: endpoint đó trả số liệu
 * thô, các endpoint này trả phần diễn giải bằng chữ của AI.
 */
@RestController
@RequestMapping("/api/reports/course-comparison/ai")
@RequiredArgsConstructor
@Tag(name = "AI Course Comparison", description = "Explain a target-vs-peers course comparison with AI")
@PreAuthorize("hasAnyAuthority('COURSE_REPORT_READ', 'COURSE_READ')")
public class CourseAiComparisonController {

    private final CourseAiComparisonService comparisonService;
    private final CourseAiOutlineService outlineService;

    /** Phân tích so sánh: 1 khóa mục tiêu + N khóa đối chiếu. */
    @PostMapping("/analyze")
    public ResponseEntity<AiCompareResponse> analyze(@Valid @RequestBody AiCompareRequest request) {
        return ResponseEntity.ok(comparisonService.compareWithPeers(request));
    }

    /** Hỏi đáp tiếp về kết quả so sánh (multi-turn). */
    @PostMapping("/ask")
    public ResponseEntity<AiFollowUpResponse> ask(@Valid @RequestBody AiFollowUpRequest request) {
        return ResponseEntity.ok(comparisonService.answerFollowUp(request));
    }

    /** So sánh cấu trúc nội dung (outline) giữa các khóa học. */
    @PostMapping("/outline")
    public ResponseEntity<AiOutlineResponse> outline(@Valid @RequestBody AiOutlineRequest request) {
        return ResponseEntity.ok(outlineService.compareOutlines(request));
    }

    /** Tóm tắt ngắn (1 đoạn) từ kết quả phân tích đã có. */
    @PostMapping("/summary")
    public ResponseEntity<AiSummaryResponse> summary(@Valid @RequestBody AiSummaryRequest request) {
        return ResponseEntity.ok(comparisonService.summarize(request));
    }
}
