package com.example.starter_project_2025.system.project.aiassistant.controller;

import com.example.starter_project_2025.system.project.aiassistant.dto.request.review.AIReviewRequest;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review.AIReviewFindingDismissRequest;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review.AIReviewReportDetail;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review.AIReviewReportListItem;
import com.example.starter_project_2025.system.project.aiassistant.entity.AIReviewReport;
import com.example.starter_project_2025.system.project.aiassistant.service.review.AIReviewFindingManagementService;
import com.example.starter_project_2025.system.project.aiassistant.service.review.AIReviewReportQueryService;
import com.example.starter_project_2025.system.project.aiassistant.service.review.ReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/project-templates/{templateId}/reviews")
@RequiredArgsConstructor
public class AIReviewReportController {

    private final AIReviewReportQueryService reportQueryService;
    private final ReviewService reviewService;
    private final AIReviewFindingManagementService findingManagementService;

    @PostMapping
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_REVIEW')")
    @ResponseStatus(HttpStatus.CREATED)
    public AIReviewReportDetail review(
            @PathVariable Long templateId,
            @Valid @RequestBody AIReviewRequest request
    ) {
        AIReviewReport report = reviewService.review(
                templateId,
                request.snapshotId()
        );

        return reportQueryService.getReportDetail(
                templateId,
                report.getId()
        );
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_REVIEW')")
    public List<AIReviewReportListItem> getReports(
            @PathVariable Long templateId
    ) {
        return reportQueryService.getReports(templateId);
    }

    @GetMapping("/{reportId}")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_REVIEW')")
    public AIReviewReportDetail getReportDetail(
            @PathVariable Long templateId,
            @PathVariable Long reportId
    ) {
        return reportQueryService.getReportDetail(templateId, reportId);
    }

    @PatchMapping("/{reportId}/findings/{findingId}/accept")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_REVIEW')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void acceptFinding(
            @PathVariable Long templateId,
            @PathVariable Long reportId,
            @PathVariable Long findingId
    ) {
        findingManagementService.accept(templateId, reportId, findingId);
    }

    @PatchMapping("/{reportId}/findings/{findingId}/dismiss")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_REVIEW')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void dismissFinding(
            @PathVariable Long templateId,
            @PathVariable Long reportId,
            @PathVariable Long findingId,
            @Valid @RequestBody AIReviewFindingDismissRequest request
    ) {
        findingManagementService.dismiss(
                templateId,
                reportId,
                findingId,
                request.reason()
        );
    }

    @PatchMapping("/{reportId}/findings/{findingId}/resolve")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_REVIEW')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resolveFinding(
            @PathVariable Long templateId,
            @PathVariable Long reportId,
            @PathVariable Long findingId
    ) {
        findingManagementService.resolve(templateId, reportId, findingId);
    }
}
