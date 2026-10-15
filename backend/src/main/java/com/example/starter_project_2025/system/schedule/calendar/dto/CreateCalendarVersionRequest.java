package com.example.starter_project_2025.system.schedule.calendar.dto;

import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionCreationMode;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CreateCalendarVersionRequest {

    @NotNull(message = "Creation mode is required")
    CalendarVersionCreationMode mode;
}
