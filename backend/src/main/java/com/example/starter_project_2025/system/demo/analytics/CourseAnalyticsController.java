package com.example.starter_project_2025.system.demo.analytics;

import com.example.starter_project_2025.system.demo.analytics.CourseAnalyticsDTO.*;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/reports")
@Tag(name = "Course Analytics", description = "Detailed course statistics APIs")
@RequiredArgsConstructor
@PreAuthorize("hasAnyAuthority('COURSE_REPORT_READ', 'COURSE_READ')")
public class CourseAnalyticsController {

    private final CourseAnalyticsService analyticsService;

    /** 1. % học viên hoàn thành từng bài + mức tụt giữa các bài. */
    @GetMapping("/courses/{courseId}/lesson-funnel")
    public LessonFunnelResponse lessonFunnel(@PathVariable Long courseId) {
        return analyticsService.getLessonFunnel(courseId);
    }

    /** 2. Đăng ký mới / bài hoàn thành / chứng chỉ theo thời gian. Mặc định 30 ngày gần nhất, theo ngày. */
    @GetMapping("/courses/{courseId}/trend")
    public TrendResponse trend(
            @PathVariable Long courseId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Granularity granularity) {
        return analyticsService.getTrend(courseId, from, to, granularity);
    }

    /** 3. Active / inactive / chưa bắt đầu + danh sách học viên có nguy cơ bỏ học. */
    @GetMapping("/courses/{courseId}/activity")
    public ActivityResponse activity(
            @PathVariable Long courseId,
            @RequestParam(required = false) Integer inactiveDays,
            @RequestParam(required = false) Integer limit) {
        return analyticsService.getActivity(courseId, inactiveDays, limit);
    }

    /** 4a. Điểm trung bình + phân bố 1-5 sao của một khóa học. */
    @GetMapping("/courses/{courseId}/review-analytics")
    public CourseReviewAnalyticsResponse reviewAnalytics(@PathVariable Long courseId) {
        return analyticsService.getReviewAnalytics(courseId);
    }

    /** 4b. Xếp hạng rating giữa các khóa học. */
    @GetMapping("/course-ratings")
    public List<CourseRatingRankItem> courseRatings() {
        return analyticsService.getCourseRatingRanking();
    }

    /** 5. Thống kê điểm / tỉ lệ đạt của các bài thi thuộc khóa học. */
    @GetMapping("/courses/{courseId}/exam-analytics")
    public CourseExamAnalyticsResponse examAnalytics(@PathVariable Long courseId) {
        return analyticsService.getExamAnalytics(courseId);
    }

    // =====================================================================
    // 6. Department analytics
    // =====================================================================

    /**
     * Phân tích hiệu quả đào tạo theo phòng ban. Bỏ trống {@code courseId} để xem
     * trên toàn hệ thống (admin: tất cả, giảng viên: khóa của mình).
     */
    @GetMapping("/department-analytics")
    public DepartmentAnalyticsResponse departmentAnalytics(
            @RequestParam(required = false) Long courseId) {
        return analyticsService.getDepartmentAnalytics(courseId);
    }

    // =====================================================================
    // 7. Course ranking
    // =====================================================================

    /** Xếp hạng khóa học theo học viên / tỉ lệ hoàn thành / rating / tỉ lệ bỏ học. */
    @GetMapping("/course-ranking")
    public CourseRankingResponse courseRanking() {
        return analyticsService.getCourseRanking();
    }

    // =====================================================================
    // 8. Content quality + Q&A
    // =====================================================================

    /** Bài học bị báo lỗi, phân loại lý do, câu hỏi chưa trả lời và thời gian phản hồi. */
    @GetMapping("/courses/{courseId}/content-quality")
    public ContentQualityResponse contentQuality(@PathVariable Long courseId) {
        return analyticsService.getContentQuality(courseId);
    }
}
