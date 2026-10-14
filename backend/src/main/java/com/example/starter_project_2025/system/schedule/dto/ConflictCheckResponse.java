package com.example.starter_project_2025.system.schedule.dto;

import com.example.starter_project_2025.system.schedule.SessionDTO;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ConflictCheckResponse {
    boolean hasConflict;
    String message;
    List<SessionDTO> conflictingSessions;
}
