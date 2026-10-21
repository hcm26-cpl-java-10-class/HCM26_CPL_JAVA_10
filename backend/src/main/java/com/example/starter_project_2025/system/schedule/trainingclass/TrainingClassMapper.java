package com.example.starter_project_2025.system.schedule.trainingclass;

import com.example.starter_project_2025.system.schedule.trainingclass.dto.TrainingClassResponse;
import com.example.starter_project_2025.system.schedule.trainingclass.dto.TrainingClassRevisionResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface TrainingClassMapper {

    @Mapping(target = "currentRevisionId", source = "currentRevision.id")
    @Mapping(target = "currentRevisionNo", source = "currentRevision.revisionNo")
    @Mapping(target = "pendingRevisionId", source = "pendingRevision.id")
    @Mapping(target = "pendingRevisionNo", source = "pendingRevision.revisionNo")
    @Mapping(target = "pendingRevisionStatus", source = "pendingRevision.status")
    TrainingClassResponse toResponse(TrainingClass trainingClass);

    @Mapping(target = "classId", source = "trainingClass.id")
    @Mapping(target = "dependencyValidationRequired", ignore = true)
    TrainingClassRevisionResponse toRevisionResponse(TrainingClassRevision revision);
}
