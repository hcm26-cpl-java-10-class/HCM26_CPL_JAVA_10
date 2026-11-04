package com.example.starter_project_2025.system.external_api.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonIgnoreProperties(ignoreUnknown = true)
public class ExternalClassDTO {

    Long id;
    String code;
    String name;
    Long programId;
    String startDate;
    String endDate;
    String status;
    Integer plannedSize;

    String site;
    String traineeType;
    String program;
    String trainingProgram;
    String classAdmin;

    @JsonAlias({"enrolledCount", "actualSize", "traineeCount"})
    Integer enrolledTrainees;

    @JsonAlias({"enrolledTrainees", "actualSize", "traineeCount"})
    Integer enrolledCount;

    String masterTrainer;
    String deliveryType;
    String formatType;
    String skills;
    String location;
    String subjectType;
    String plannedRevenue;
    String scope;
    String supplierPartner;
    String keyProgram;
    String globalSe;
    Object jobRecommendation;

    public Integer getEnrolledCount() {
        return enrolledCount != null ? enrolledCount : enrolledTrainees;
    }

    public Integer getEnrolledTrainees() {
        return enrolledTrainees != null ? enrolledTrainees : enrolledCount;
    }
}
