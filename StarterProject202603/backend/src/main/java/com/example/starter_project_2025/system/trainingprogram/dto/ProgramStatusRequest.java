package com.example.trainingprogram.dto;

import com.example.trainingprogram.entity.ProgramStatus;
import jakarta.validation.constraints.NotNull;

public record ProgramStatusRequest(@NotNull ProgramStatus status) {}
