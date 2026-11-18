package com.example.starter_project_2025.system.demo.analytics;

import com.example.starter_project_2025.system.demo.analytics.LearnerEngagementDTO.*;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reports")
@Tag(name = "Learner Engagement", description = "Bottlenecks, problem learners, nudges and learner rankings")
@RequiredArgsConstructor
@PreAuthorize("hasAnyAuthority('COURSE_REPORT_READ', 'COURSE_READ')")
public class LearnerEngagementController {

    private final LearnerEngagementService engagementService;

    /** Điểm nghẽn: bài nào học viên hay dừng lại / bỏ học nhất. */
    @GetMapping("/courses/{courseId}/bottlenecks")
    public BottleneckResponse bottlenecks(
            @PathVariable Long courseId,
            @RequestParam(required = false) Integer inactiveDays) {
        return engagementService.getBottlenecks(courseId, inactiveDays);
    }

    /**
     * Danh sách người học có vấn đề (chưa bắt đầu, bỏ học, không hoạt động, điểm thi thấp).
     * {@code problemType} = NEVER_STARTED | DROPPED_OUT | INACTIVE | LOW_EXAM_SCORE | ALL.
     */
    @GetMapping("/courses/{courseId}/problem-learners")
    public ProblemLearnersResponse problemLearners(
            @PathVariable Long courseId,
            @RequestParam(required = false) Integer inactiveDays,
            @RequestParam(required = false) String problemType) {
        return engagementService.getProblemLearners(courseId, inactiveDays, problemType);
    }

    /** Gửi thông báo nhắc học cho người học được chọn (hoặc cả nhóm vấn đề). */
    @PostMapping("/courses/{courseId}/nudges")
    public NudgeResult sendNudges(
            @PathVariable Long courseId,
            @RequestBody(required = false) NudgeRequest request) {
        return engagementService.sendNudges(courseId, request);
    }

    /**
     * Top người học chăm nhất của từng phòng ban + toàn hệ thống.
     * {@code limit} 1-100 (mặc định 10), {@code sortBy} = STUDY_TIME | LESSONS_COMPLETED.
     */
    @GetMapping("/department-top-learners")
    public TopLearnersResponse topLearners(
            @RequestParam(required = false) Long courseId,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String sortBy) {
        return engagementService.getTopLearners(courseId, limit, sortBy);
    }
}
