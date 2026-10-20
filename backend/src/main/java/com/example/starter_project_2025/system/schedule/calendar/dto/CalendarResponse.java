package com.example.starter_project_2025.system.schedule.calendar.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CalendarResponse {

    private Long id;
    private Long classId;
    private Integer lastIssuedVersionNumber;
}