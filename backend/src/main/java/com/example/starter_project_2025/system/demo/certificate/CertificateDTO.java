package com.example.starter_project_2025.system.demo.certificate;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CertificateDTO extends BaseDTO {
    @NotNull(groups = OnCreate.class, message = "Course is required")
    Long courseId;

    String courseName;

    @NotNull(groups = OnCreate.class, message = "User is required")
    Long userId;

    String userFullName;

    UUID verificationToken;

    LocalDate issuedAt;

}
