package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.dto.ExamTakerDTO;
import com.example.starter_project_2025.system.question.domain.Question;
import com.example.starter_project_2025.system.question.mapper.QuestionTakerMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ExamTakerService {

    private final ExamRepository examRepository;
    private final QuestionTakerMapper questionTakerMapper;

    @Transactional(readOnly = true)
    public ExamTakerDTO getForTaking(Long id) {
        Exam exam = examRepository.findById(id)
                .filter(e -> Boolean.TRUE.equals(e.getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found"));

        List<Question> sorted = exam.getQuestions().stream()
                .sorted(Comparator.comparing(Question::getId)).toList();

        ExamTakerDTO d = new ExamTakerDTO();
        d.setId(exam.getId());
        d.setTitle(exam.getTitle());
        d.setDurationMinutes(exam.getDurationMinutes());
        d.setTotalPoints(sorted.stream().mapToInt(Question::getPoints).sum());
        d.setQuestions(sorted.stream().map(questionTakerMapper::toTakerResponse).toList());
        return d;
    }
}