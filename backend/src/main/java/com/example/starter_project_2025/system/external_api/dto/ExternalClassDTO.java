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
    @JsonAlias({"enrolledTrainees", "actualSize", "traineeCount"})
    Integer enrolledCount;
    String deliveryType;
    String traineeType;
    String formatType;
    String skills;
    String site;
    String location;
    String subjectType;
    String scope;
    String supplierPartner;
    String keyProgram;
    Boolean jobRecommendation;
}
