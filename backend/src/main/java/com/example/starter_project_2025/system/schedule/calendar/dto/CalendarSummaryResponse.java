package com.example.starter_project_2025.system.schedule.calendar.dto;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

@Setter
@Getter
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CalendarSummaryResponse extends BaseDTO  {

    Long classId;
    String name;
    String description;
    Integer activeVersionNumber;
}