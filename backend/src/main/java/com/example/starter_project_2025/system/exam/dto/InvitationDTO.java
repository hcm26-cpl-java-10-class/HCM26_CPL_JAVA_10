package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.system.exam.domain.InvitationStatus;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY;

@Getter
@Setter
public class InvitationDTO extends BaseDTO {

    @NotNull(groups = OnCreate.class)
    private Long examId;

    private Long userId;

    @JsonProperty(access = READ_ONLY)
    private String examTitle;

    @JsonProperty(access = READ_ONLY)
    private String userFullName;

    @JsonProperty(access = READ_ONLY)
    private String userEmail;

    @JsonProperty(access = READ_ONLY)
    private String token;

    private InvitationStatus status;

    @JsonProperty(access = READ_ONLY)
    private LocalDateTime sentAt;

    private LocalDateTime expiresAt;

    @JsonProperty(access = READ_ONLY)
    private LocalDateTime acceptedAt;

    @JsonProperty(access = READ_ONLY)
    private LocalDateTime rejectedAt;

    @JsonProperty(access = READ_ONLY)
    private LocalDateTime revokedAt;

    @JsonProperty(access = READ_ONLY)
    private String revokedReason;

    private String note;

    @JsonProperty(access = READ_ONLY)
    private Integer resendCount;

    private Boolean anonymous;

    @JsonProperty(access = READ_ONLY)
    private String guestName;

    @JsonProperty(access = READ_ONLY)
    private String guestEmail;

    @JsonProperty(access = READ_ONLY)
    private String accessCode;

    @JsonProperty(access = READ_ONLY)
    private String oneTimeToken;

    private LocalDateTime maxAccessTime;

    private Integer maxAccessAttempts;

    @JsonProperty(access = READ_ONLY)
    private Integer accessAttemptCount;

    // ===== Thông tin đề thi cho phía student (read-only) =====
    // Frontend dùng các field này để render notification và quyết định
    // có mở dialog mật khẩu / có cho vào thi hay không.

    @JsonProperty(access = READ_ONLY)
    private LocalDateTime examStartTime;

    @JsonProperty(access = READ_ONLY)
    private LocalDateTime examEndTime;

    @JsonProperty(access = READ_ONLY)
    private Integer examDurationMinutes;

    @JsonProperty(access = READ_ONLY)
    private Integer examMaxAttempts;

    @JsonProperty(access = READ_ONLY)
    private Boolean examHasPassword;
}
