package com.example.starter_project_2025.system.demo.calendar;
import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import lombok.Getter;
import lombok.Setter;
@Getter
@Setter
public class CalendarFilter extends BaseFilter {
    @FilterField
    private Long classId;
}
