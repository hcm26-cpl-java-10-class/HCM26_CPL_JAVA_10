package com.example.starter_project_2025.system.exam.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter @Setter
public class CodeRunRequest {
    @NotNull
    private Long questionId;
    private String code;
    /** Dau vao tuy y (moi tham so mot gia tri). Bo trong neu chi muon chay 2 test hien thi. */
    private List<String> customInputs;
}
