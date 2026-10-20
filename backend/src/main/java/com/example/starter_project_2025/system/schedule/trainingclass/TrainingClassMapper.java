package com.example.starter_project_2025.system.schedule.trainingclass;

import com.example.starter_project_2025.system.schedule.trainingclass.dto.TrainingClassResponse;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface TrainingClassMapper {

    TrainingClassResponse toResponse(TrainingClass trainingClass);
}