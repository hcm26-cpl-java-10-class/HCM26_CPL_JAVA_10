package com.example.starter_project_2025.system.schedule.session.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.validator.constraints.URL;

import java.time.LocalDateTime;

@Getter
@Setter
public class CreateSessionRequest {

    @NotBlank
    @Size(max = 150)
    private String title;

    @NotNull
    @Positive
    private Long topicId;

    @NotNull
    @Positive
    private Long trainerId;

    @NotNull
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime startTime;

    @NotNull
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime endTime;

    @Size(max = 80)
    private String room;

    @Size(max = 255)
    @URL(regexp = "https?://.+")
    private String meetingLink;
}
