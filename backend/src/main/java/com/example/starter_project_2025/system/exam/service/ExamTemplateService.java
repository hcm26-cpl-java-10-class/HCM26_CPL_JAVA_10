
package com.example.starter_project_2025.system.exam.service;

import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.domain.ExamTemplate;
import com.example.starter_project_2025.system.exam.domain.ExamTemplateQuestion;
import com.example.starter_project_2025.system.exam.domain.ExamTemplateQuestionOption;
import com.example.starter_project_2025.system.exam.domain.ExamTemplateRepository;
import com.example.starter_project_2025.system.exam.dto.CreateExamFromTemplateRequest;
import com.example.starter_project_2025.system.exam.dto.ExamDTO;
import com.example.starter_project_2025.system.exam.dto.ExamTemplateDTO;
import com.example.starter_project_2025.system.exam.dto.SaveExamTemplateRequest;
import com.example.starter_project_2025.system.exam.mapper.ExamMapper;
import com.example.starter_project_2025.system.question.domain.Question;
import com.example.starter_project_2025.system.question.domain.QuestionOption;
import com.example.starter_project_2025.system.question.domain.QuestionRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ExamTemplateService {

    private final ExamRepository examRepository;
    private final ExamTemplateRepository templateRepository;
    private final QuestionRepository questionRepository;
    private final ExamMapper examMapper;

    @Transactional
    public ExamTemplateDTO saveAsTemplate(
            Long examId,
            SaveExamTemplateRequest request) {

        Exam exam = examRepository.findById(examId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Exam not found"));

        ExamTemplate template = new ExamTemplate();
        template.setIsActive(Boolean.TRUE);
        template.setName(request.getName().trim());
        template.setDescription(request.getDescription());

        // Copy exam configuration
        template.setDurationMinutes(exam.getDurationMinutes());
        template.setMaxAttempts(exam.getMaxAttempts());
        template.setShuffleQuestions(exam.getShuffleQuestions());
        template.setShuffleOptions(exam.getShuffleOptions());
        template.setShowAnswersAfterExam(exam.getShowAnswersAfterExam());
        template.setPassScore(exam.getPassScore());
        template.setMaxScore(exam.getMaxScore());
        template.setLatePolicy(exam.getLatePolicy());
        template.setLatePenaltyPercent(exam.getLatePenaltyPercent());
        template.setLateGraceMinutes(exam.getLateGraceMinutes());
        template.setResultVisibility(exam.getResultVisibility());
        template.setExamType(exam.getExamType());
        template.setCategory(exam.getCategory());

        int position = 0;

        var sortedQuestions = exam.getQuestions().stream()
                .sorted(Comparator.comparing(
                        Question::getId,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();

        for (Question source : sortedQuestions) {
            ExamTemplateQuestion snapshot = new ExamTemplateQuestion();
            snapshot.setTemplate(template);
            snapshot.setContent(source.getContent());
            snapshot.setType(source.getType());
            snapshot.setDifficulty(source.getDifficulty());
            snapshot.setTopic(source.getTopic());
            snapshot.setImageUrl(source.getImageUrl());
            snapshot.setPoints(source.getPoints());
            snapshot.setPosition(position++);

            int optionPosition = 0;

            for (QuestionOption sourceOption : source.getOptions()) {
                ExamTemplateQuestionOption option =
                        new ExamTemplateQuestionOption();

                option.setTemplateQuestion(snapshot);
                option.setContent(sourceOption.getContent());
                option.setCorrect(sourceOption.isCorrect());
                option.setImageUrl(sourceOption.getImageUrl());
                option.setPosition(optionPosition++);

                snapshot.getOptions().add(option);
            }

            template.getQuestions().add(snapshot);
        }

        ExamTemplate saved = templateRepository.save(template);
        return toTemplateDTO(saved);
    }

    @Transactional
    public ExamDTO createExamFromTemplate(
            Long templateId,
            CreateExamFromTemplateRequest request) {

        ExamTemplate template = templateRepository.findById(templateId)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Exam template not found"));

        Exam exam = new Exam();
        exam.setIsActive(Boolean.TRUE);
        exam.setTitle(request.getTitle().trim());
        exam.setStartTime(request.getStartTime());
        exam.setEndTime(request.getEndTime());

        // Copy exam configuration from template
        exam.setDurationMinutes(template.getDurationMinutes());
        exam.setMaxAttempts(template.getMaxAttempts());
        exam.setShuffleQuestions(template.getShuffleQuestions());
        exam.setShuffleOptions(template.getShuffleOptions());
        exam.setShowAnswersAfterExam(template.getShowAnswersAfterExam());
        exam.setPassScore(template.getPassScore());
        exam.setMaxScore(template.getMaxScore());
        exam.setLatePolicy(template.getLatePolicy());
        exam.setLatePenaltyPercent(template.getLatePenaltyPercent());
        exam.setLateGraceMinutes(template.getLateGraceMinutes());
        exam.setResultVisibility(template.getResultVisibility());
        exam.setExamType(template.getExamType());
        exam.setCategory(template.getCategory());

        Set<Question> newQuestions = new LinkedHashSet<>();

        var sortedSnapshots = template.getQuestions().stream()
                .sorted(Comparator.comparingInt(
                        ExamTemplateQuestion::getPosition))
                .toList();

        for (ExamTemplateQuestion snapshot : sortedSnapshots) {
            Question question = new Question();
            question.setIsActive(Boolean.TRUE);
            question.setContent(snapshot.getContent());
            question.setType(snapshot.getType());
            question.setDifficulty(snapshot.getDifficulty());
            question.setTopic(snapshot.getTopic());
            question.setImageUrl(snapshot.getImageUrl());
            question.setPoints(snapshot.getPoints());

            // This is a new question created from a template,
            // not a copy of a question-bank item.
            question.setSourceQuestionId(null);

            var sortedOptions = snapshot.getOptions().stream()
                    .sorted(Comparator.comparingInt(
                            ExamTemplateQuestionOption::getPosition))
                    .toList();

            for (ExamTemplateQuestionOption snapshotOption : sortedOptions) {
                QuestionOption option = new QuestionOption();
                option.setContent(snapshotOption.getContent());
                option.setCorrect(snapshotOption.isCorrect());
                option.setImageUrl(snapshotOption.getImageUrl());
                option.setQuestion(question);

                question.getOptions().add(option);
            }

            newQuestions.add(questionRepository.save(question));
        }

        exam.setQuestions(newQuestions);
        Exam savedExam = examRepository.save(exam);

        return examMapper.toResponse(savedExam);
    }

    /**
     * Lấy danh sách đề thi mẫu.
     */
    @Transactional(readOnly = true)
    public List<ExamTemplateDTO> listTemplates() {
        return templateRepository.findAll()
                .stream()
                .map(this::toTemplateDTO)
                .toList();
    }

    /**
     * Lấy chi tiết một đề thi mẫu.
     */
    @Transactional(readOnly = true)
    public ExamTemplateDTO getTemplate(Long templateId) {
        ExamTemplate template = templateRepository.findById(templateId)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Exam template not found"));

        return toTemplateDTO(template);
    }

    /**
     * Xóa đề thi mẫu.
     */
    @Transactional
    public void deleteTemplate(Long templateId) {
        ExamTemplate template = templateRepository.findById(templateId)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Exam template not found"));

        templateRepository.delete(template);
    }

    private ExamTemplateDTO toTemplateDTO(ExamTemplate template) {
        ExamTemplateDTO dto = new ExamTemplateDTO();
        dto.setId(template.getId());
        dto.setName(template.getName());
        dto.setDescription(template.getDescription());
        dto.setDurationMinutes(template.getDurationMinutes());
        dto.setMaxAttempts(template.getMaxAttempts());
        dto.setQuestionCount(template.getQuestions().size());
        dto.setCreatedAt(template.getCreatedAt());
        dto.setUpdatedAt(template.getUpdatedAt());

        return dto;
    }
}
