package com.example.starter_project_2025.system.trainingprogram;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface TrainingProgramService {
    List<TrainingProgramResponse> findAll(String search, ProgramStatus status, String region);
    List<String> findRegions();
    Page<TrainingProgramResponse> findPage(String search, ProgramStatus status, String region, Pageable pageable);
    TrainingProgramResponse findById(Long id);
    TrainingProgramResponse create(TrainingProgramRequest request);
    TrainingProgramResponse update(Long id, TrainingProgramRequest request);
    TrainingProgramResponse updateSubjects(Long id, List<ProgramSubjectRequest> subjects);
    TrainingProgramResponse cloneVersion(Long id, String newVersion);
    TrainingProgramResponse activate(Long id);
    TrainingProgramResponse changeStatus(Long id, ProgramStatus status);
    void delete(Long id);
}
