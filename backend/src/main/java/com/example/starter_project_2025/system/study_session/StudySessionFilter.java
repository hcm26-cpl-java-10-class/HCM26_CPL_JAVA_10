package com.example.starter_project_2025.system.study_session;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import com.example.starter_project_2025.base.crud.spec.FilterOperator;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
public class StudySessionFilter extends BaseFilter {

	@FilterField
	Long subjectId;

	@FilterField
	StudySessionType type;

    @FilterField
    SessionStatus status;

    @FilterField(operator = FilterOperator.LIKE)
    String title;

    @FilterField(operator = FilterOperator.LIKE)
    String room;

    @FilterField(operator = FilterOperator.LIKE)
    String lecturer;

	@FilterField(entityField = "sessionDate", operator = FilterOperator.GREATER_OR_EQUAL)
	@org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE)
	LocalDate sessionDateFrom;

	@FilterField(entityField = "sessionDate", operator = FilterOperator.LESS_OR_EQUAL)
	@org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE)
	LocalDate sessionDateTo;
}
