package com.example.starter_project_2025.system.demo.course_assessment;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AssessmentServiceImpl
        extends BaseCrudServiceImpl<Assessment, Long, AssessmentDTO, AssessmentFilter>
        implements AssessmentService{

    AssessmentRepository assessmentRepository;
    AssessmentMapper assessmentMapper;

    @Override
    protected BaseCrudRepository<Assessment, Long> getRepository() {
        return assessmentRepository;
    }

    @Override
    protected BaseCrudMapper<Assessment, AssessmentDTO> getMapper() {
        return assessmentMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{"name", "description"};
    }
}
