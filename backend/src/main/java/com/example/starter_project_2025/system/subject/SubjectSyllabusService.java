package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.subject.dto.SubjectSyllabusDTO;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SubjectSyllabusService {

    static final String DEFAULT_PASS_SCORE = ">= 6.0 / 10";
    static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};
    static final TypeReference<List<Map<String, Object>>> LIST_OF_MAP_TYPE = new TypeReference<>() {};

    SubjectRepository subjectRepository;
    SubjectSyllabusRepository subjectSyllabusRepository;
    ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    @PreAuthorize("hasAuthority('SUBJECT_READ')")
    public SubjectSyllabusDTO getSyllabus(Long subjectId) {
        ensureSubjectExists(subjectId);
        return subjectSyllabusRepository.findBySubject_Id(subjectId)
                .map(this::toDto)
                .orElseGet(() -> SubjectSyllabusDTO.builder()
                        .subjectId(subjectId)
                        .passScore(DEFAULT_PASS_SCORE)
                        .chapters(List.of())
                        .build());
    }

    @PreAuthorize("hasAuthority('SUBJECT_UPDATE')")
    public SubjectSyllabusDTO saveSyllabus(Long subjectId, SubjectSyllabusDTO request) {
        Subject subject = ensureSubjectExists(subjectId);
        SubjectSyllabus entity = subjectSyllabusRepository.findBySubject_Id(subjectId)
                .orElseGet(() -> SubjectSyllabus.builder().subject(subject).isActive(true).build());

        String normalizedPassScore = request != null && request.getPassScore() != null && !request.getPassScore().isBlank()
                ? request.getPassScore().trim()
                : DEFAULT_PASS_SCORE;
        entity.setPassScore(normalizedPassScore);
        entity.setMetaJson(writeJson(request != null ? request.getMeta() : null));
        entity.setChaptersJson(writeJson(request != null && request.getChapters() != null ? request.getChapters() : List.of()));
        entity.setAssessmentSchemeJson(writeJson(request != null ? request.getAssessmentScheme() : null));

        return toDto(subjectSyllabusRepository.save(entity));
    }

    @PreAuthorize("hasAuthority('SUBJECT_UPDATE')")
    public void resetSyllabus(Long subjectId) {
        ensureSubjectExists(subjectId);
        subjectSyllabusRepository.deleteBySubject_Id(subjectId);
    }

    private Subject ensureSubjectExists(Long subjectId) {
        return subjectRepository.findById(subjectId)
                .orElseThrow(() -> new ResourceNotFoundException("Subject not found with ID: " + subjectId));
    }

    private SubjectSyllabusDTO toDto(SubjectSyllabus entity) {
        List<Map<String, Object>> chapters = readJson(entity.getChaptersJson(), LIST_OF_MAP_TYPE);
        return SubjectSyllabusDTO.builder()
                .subjectId(entity.getSubject().getId())
                .passScore(entity.getPassScore() != null ? entity.getPassScore() : DEFAULT_PASS_SCORE)
                .meta(readJson(entity.getMetaJson(), MAP_TYPE))
                .chapters(chapters != null ? chapters : List.of())
                .assessmentScheme(readJson(entity.getAssessmentSchemeJson(), LIST_OF_MAP_TYPE))
                .build();
    }

    private String writeJson(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            throw new BadRequestException("Invalid syllabus payload structure");
        }
    }

    private <T> T readJson(String raw, TypeReference<T> type) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(raw, type);
        } catch (Exception ex) {
            throw new IllegalStateException("Corrupted syllabus JSON stored in database", ex);
        }
    }
}
