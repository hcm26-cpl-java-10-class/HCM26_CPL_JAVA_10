package com.example.starter_project_2025.base.crud.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY;

@Getter
@Setter
public abstract class BaseDTO {

    private Long id;

    private Boolean isActive;

    @JsonProperty(access = READ_ONLY)
    private LocalDateTime createdAt;

    @JsonProperty(access = READ_ONLY)
    private LocalDateTime updatedAt;

    @JsonProperty(access = READ_ONLY)
    private Long createdBy;

    @JsonProperty(access = READ_ONLY)
    private Long updatedBy;
}
