package com.example.starter_project_2025.system.invitation.dto;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;
import com.example.starter_project_2025.system.invitation.domain.InvitationStatus;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY;

@Getter
@Setter
public class InvitationDTO extends BaseDTO {

    @NotNull(groups = OnCreate.class, message = "examId không được để trống")
    private Long examId;

    @NotNull(groups = OnCreate.class, message = "userId không được để trống")
    private Long userId;

    @JsonProperty(access = READ_ONLY)
    private String examTitle;

    @JsonProperty(access = READ_ONLY)
    private Integer durationMinutes;

    @JsonProperty(access = READ_ONLY)
    private LocalDateTime startTime;

    @JsonProperty(access = READ_ONLY)
    private LocalDateTime endTime;

    @JsonProperty(access = READ_ONLY)
    private Integer maxAttempts;

    @JsonProperty(access = READ_ONLY)
    private Integer totalPoints;

    @JsonProperty(access = READ_ONLY)
    private String userEmail;

    @JsonProperty(access = READ_ONLY)
    private String userFullName;

    private InvitationStatus status;

    private LocalDateTime sentAt;

    private Integer resendCount;

    private LocalDateTime revokedAt;

    private String revokedReason;

    private LocalDateTime expiresAt;

    @Size(max = 1000, groups = {OnCreate.class, OnUpdate.class}, message = "Ghi chú không được vượt quá 1000 ký tự")
    private String note;
}
