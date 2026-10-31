package com.example.starter_project_2025.system.external_api.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
public record ExternalClassRequest(
        @NotBlank @Size(max = 50) String code,
        @NotBlank @Size(max = 255) String name,
        @Pattern(regexp = "^$|^\\d{4}-\\d{2}-\\d{2}$", message = "startDate must use yyyy-MM-dd format") String startDate,
        @Pattern(regexp = "^$|^\\d{4}-\\d{2}-\\d{2}$", message = "endDate must use yyyy-MM-dd format") String endDate,
        @NotBlank @Pattern(regexp = "(?i)active|inactive", message = "status must be active or inactive") String status,
        @Min(1) @Max(10000) Integer plannedSize,
        @Size(max = 100) String deliveryType,
        @Size(max = 100) String traineeType,
        @Size(max = 100) String formatType,
        @Size(max = 255) String skills,
        @Size(max = 150) String site,
        @Size(max = 255) String location,
        @Size(max = 100) String subjectType,
        @Size(max = 100) String scope,
        @Size(max = 150) String supplierPartner,
        @Size(max = 150) String keyProgram,
        Boolean jobRecommendation
) {
}
