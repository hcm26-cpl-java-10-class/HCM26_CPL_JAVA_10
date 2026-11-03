package com.example.starter_project_2025.system.external_api.dto;

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
    Integer enrolledTrainees;
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
    String jobRecommendation;
}
