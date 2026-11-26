package com.example.starter_project_2025.system.demo.certificate.insights;

import com.example.starter_project_2025.system.demo.certificate.insights.CertificateInsightsDTO.CellDetailResponse;
import com.example.starter_project_2025.system.demo.certificate.insights.CertificateInsightsDTO.HeatmapResponse;
import com.example.starter_project_2025.system.demo.certificate.insights.CertificateInsightsDTO.Overview;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/certificates/insights")
@RequiredArgsConstructor
@Tag(
        name = "Certificate Insights",
        description = "Certificate coverage by department and skill group"
)
@PreAuthorize("hasAuthority('CERTIFICATE_READ')")
public class CertificateInsightsController {

    private final CertificateInsightsService service;

    @GetMapping("/overview")
    public Overview overview() {
        return service.getOverview();
    }

    @GetMapping("/heatmap")
    public HeatmapResponse heatmap() {
        return service.getHeatmap();
    }

    @GetMapping("/cells/{departmentId}/{categoryId}")
    public CellDetailResponse cellDetail(
            @PathVariable Long departmentId,
            @PathVariable Long categoryId
    ) {
        return service.getCellDetail(
                departmentId,
                categoryId
        );
    }
}
