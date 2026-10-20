package com.example.starter_project_2025.system.trainingprogram;

import java.util.List;

public interface TrainingProgramService {
    List<TrainingProgramResponse> findAll(String search, ProgramStatus status, String region);
    TrainingProgramResponse findById(Long id);
    TrainingProgramResponse create(TrainingProgramRequest request);
    TrainingProgramResponse update(Long id, TrainingProgramRequest request);
    TrainingProgramResponse updateSubjects(Long id, List<ProgramSubjectRequest> subjects);
    TrainingProgramResponse cloneVersion(Long id, String newVersion);
    TrainingProgramResponse activate(Long id);
    TrainingProgramResponse changeStatus(Long id, ProgramStatus status);
}
