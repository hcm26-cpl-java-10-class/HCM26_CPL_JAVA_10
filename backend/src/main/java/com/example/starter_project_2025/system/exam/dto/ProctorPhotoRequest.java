package com.example.starter_project_2025.system.exam.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/** Anh chup nguoi thi luc vao thi (data URL jpeg). */
@Getter @Setter
public class ProctorPhotoRequest {
    @NotBlank
    @Size(max = 400000)
    private String imageData;
}
