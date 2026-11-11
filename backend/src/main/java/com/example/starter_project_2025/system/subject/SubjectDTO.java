package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SubjectDTO extends BaseDTO {

    SubjectStatus status;

    @NotBlank(groups = OnCreate.class, message = "Subject code is required")
    @Size(max = 50, message = "Subject code must not exceed 50 characters")
    String code;

    @NotBlank(groups = OnCreate.class, message = "Subject name is required")
    @Size(max = 255, message = "Subject name must not exceed 255 characters")
    String name;

    @NotBlank(groups = OnCreate.class, message = "Version is required")
    @Size(max = 20, message = "Version must not exceed 20 characters")
    String version;

    String description;

    @Size(max = 4000, message = "Objectives must not exceed 4000 characters")
    String objectives;

    @Size(max = 4000, message = "Skills must not exceed 4000 characters")
    String skills;

    SubjectDeliveryMode deliveryMode;

    @Size(max = 12000, message = "Outline must not exceed 12000 characters")
    String outline;

    @Size(max = 100, message = "Technical group must not exceed 100 characters")
    String technicalGroup;

    @NotNull(groups = OnCreate.class, message = "Hours is required")
    @DecimalMin(value = "0", inclusive = false, message = "Hours must be greater than 0")
    @DecimalMax(value = "2147483647", message = "Hours exceeds the supported range")
    @Digits(integer = 10, fraction = 9, message = "Hours supports up to 9 decimal places")
    @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using = SubjectHoursDeserializer.class)
    java.math.BigDecimal durationHours;

    public java.math.BigDecimal getDurationHours() {
        return SubjectDuration.normalize(durationHours);
    }
}
