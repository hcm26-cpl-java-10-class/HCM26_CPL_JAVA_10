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

	@FilterField(entityField = "sessionDate", operator = FilterOperator.GREATER_OR_EQUAL)
	LocalDate sessionDateFrom;

	@FilterField(entityField = "sessionDate", operator = FilterOperator.LESS_OR_EQUAL)
	LocalDate sessionDateTo;
}