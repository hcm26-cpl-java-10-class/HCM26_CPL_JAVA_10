package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import com.example.starter_project_2025.system.trainingprogram.ProgramSubjectRepository;
import com.example.starter_project_2025.system.trainingprogram.TeachingAssignmentRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SubjectServiceImpl
        extends BaseCrudServiceImpl<Subject, Long, SubjectDTO, SubjectFilter>
        implements SubjectService {

    SubjectMapper subjectMapper;
    SubjectRepository subjectRepository;
    SubjectSyllabusRepository subjectSyllabusRepository;
    SubjectValidator subjectValidator;
    SessionRepository sessionRepository;
    ProgramSubjectRepository programSubjectRepository;
    TeachingAssignmentRepository teachingAssignmentRepository;

    @Override
    protected BaseCrudRepository<Subject, Long> getRepository() {
        return subjectRepository;
    }

    @Override
    protected BaseCrudMapper<Subject, SubjectDTO> getMapper() {
        return subjectMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{"code", "name", "technicalGroup"};
    }

    @Override
    protected void beforeCreate(Subject subject, SubjectDTO request, ValidationContext ctx) {
        subjectValidator.prepareForCreate(subject, request, ctx);
    }

    @Override
    protected void beforeUpdate(Subject subject, SubjectDTO request, ValidationContext ctx) {
        subjectValidator.prepareForUpdate(subject, request, ctx);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SubjectDTO> getActiveSubjects() {
        return subjectRepository.findByIsActiveTrueAndStatus(SubjectStatus.ACTIVE)
                .stream()
                .map(subjectMapper::toResponse)
                .toList();
    }

    @Override
    public SubjectDTO changeStatus(Long id, Boolean isActive) {
        Subject subject = subjectRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Subject not found with ID: " + id));

        boolean active = Boolean.TRUE.equals(isActive);
        subject.setIsActive(active);
        subject.setStatus(active ? SubjectStatus.ACTIVE : SubjectStatus.INACTIVE);
        Subject saved = subjectRepository.save(subject);
        return subjectMapper.toResponse(saved);
    }

    @Override
    protected void beforeDelete(Subject subject) {
        if (isSubjectReferenced(subject.getId())) {
            throw new BadRequestException(String.format(
                    "Cannot delete topic [%s - v%s] because it is referenced in the system. " +
                    "Please set status to Inactive instead to preserve historical training records.",
                    subject.getCode(), subject.getVersion()
            ));
        }
        if (subjectSyllabusRepository != null && subject.getId() != null) {
            subjectSyllabusRepository.deleteBySubject_Id(subject.getId());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isSubjectReferenced(Long id) {
        if (id == null) {
            return false;
        }

        if (sessionRepository != null && sessionRepository.existsByTopicId(id)) {
            return true;
        }

        if (programSubjectRepository != null && programSubjectRepository.existsBySubject_Id(id)) {
            return true;
        }

        return teachingAssignmentRepository != null
                && teachingAssignmentRepository.existsByProgramSubject_Subject_Id(id);
    }
}
