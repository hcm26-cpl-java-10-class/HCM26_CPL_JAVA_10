package com.example.starter_project_2025.system.schedule.generation.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BulkSaveSessionsRequestDTO {

    @NotEmpty(message = "Session list cannot be empty")
    List<PreviewSessionItemDTO> sessions;
}
