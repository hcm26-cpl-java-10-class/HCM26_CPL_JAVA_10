
package com.example.starter_project_2025.system.schedule.calendar.dto;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CalendarVersionResponse extends BaseDTO {

    Long calendarId;
    Integer versionNumber;
    CalendarVersionStatus status;
    LocalDateTime activatedAt;
    Long activatedBy;
}
