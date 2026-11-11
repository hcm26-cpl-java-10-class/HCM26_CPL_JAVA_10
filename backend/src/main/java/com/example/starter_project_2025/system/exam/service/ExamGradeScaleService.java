package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamGradeScale;
import com.example.starter_project_2025.system.exam.domain.ExamGradeScaleRepository;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.dto.GradeScaleDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ExamGradeScaleService {

    private final ExamGradeScaleRepository gradeScaleRepository;
    private final ExamRepository examRepository;

    /**
     * Thang điểm chữ mặc định:
     * A: 8.0 - 10.0 (Giỏi)
     * B: 6.5 - 7.99 (Khá)
     * C: 5.0 - 6.49 (Trung bình)
     * D: 4.0 - 4.99 (Yếu)
     * F: 0.0 - 3.99 (Trượt)
     */
    public List<GradeScaleDTO> getDefaultGradeScales() {
        return List.of(
                new GradeScaleDTO(null, "GRADE", "A", new BigDecimal("8.0"), new BigDecimal("10.0"), "Excellent", "#10b981", 1),
                new GradeScaleDTO(null, "GRADE", "B", new BigDecimal("6.5"), new BigDecimal("7.99"), "Good", "#3b82f6", 2),
                new GradeScaleDTO(null, "GRADE", "C", new BigDecimal("5.0"), new BigDecimal("6.49"), "Average", "#f59e0b", 3),
                new GradeScaleDTO(null, "GRADE", "D", new BigDecimal("4.0"), new BigDecimal("4.99"), "Below Average", "#f97316", 4),
                new GradeScaleDTO(null, "GRADE", "F", new BigDecimal("0.0"), new BigDecimal("3.99"), "Failed", "#ef4444", 5)
        );
    }

    /**
     * Default percentage bands:
     * 0-49%, 50-59%, 60-69%, 70-79%, 80-89%, 90-100%
     */
    public List<GradeScaleDTO> getDefaultPercentageScales() {
        return List.of(
                new GradeScaleDTO(null, "PERCENTAGE", "0-49%", new BigDecimal("0.0"), new BigDecimal("49.99"), "Poor / Fail", "#ef4444", 1),
                new GradeScaleDTO(null, "PERCENTAGE", "50-59%", new BigDecimal("50.0"), new BigDecimal("59.99"), "Below Average", "#f97316", 2),
                new GradeScaleDTO(null, "PERCENTAGE", "60-69%", new BigDecimal("60.0"), new BigDecimal("69.99"), "Average", "#f59e0b", 3),
                new GradeScaleDTO(null, "PERCENTAGE", "70-79%", new BigDecimal("70.0"), new BigDecimal("79.99"), "Good", "#3b82f6", 4),
                new GradeScaleDTO(null, "PERCENTAGE", "80-89%", new BigDecimal("80.0"), new BigDecimal("89.99"), "Very Good", "#6366f1", 5),
                new GradeScaleDTO(null, "PERCENTAGE", "90-100%", new BigDecimal("90.0"), new BigDecimal("100.0"), "Excellent", "#10b981", 6)
        );
    }

    @Transactional(readOnly = true)
    public List<GradeScaleDTO> getScales(Long examId, String type) {
        String scaleType = (type != null && type.equalsIgnoreCase("PERCENTAGE")) ? "PERCENTAGE" : "GRADE";
        List<ExamGradeScale> list = gradeScaleRepository.findAllByExam_IdAndScaleTypeOrderByDisplayOrderAsc(examId, scaleType);
        if (list.isEmpty()) {
            return scaleType.equals("PERCENTAGE") ? getDefaultPercentageScales() : getDefaultGradeScales();
        }
        return list.stream()
                .map(s -> new GradeScaleDTO(
                        s.getId(),
                        s.getScaleType(),
                        s.getGradeLetter(),
                        s.getMinScore(),
                        s.getMaxScore(),
                        s.getLabel(),
                        s.getColor(),
                        s.getDisplayOrder()
                ))
                .toList();
    }

    @Transactional
    public List<GradeScaleDTO> saveScales(Long examId, String type, List<GradeScaleDTO> dtoList) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found: " + examId));

        String scaleType = (type != null && type.equalsIgnoreCase("PERCENTAGE")) ? "PERCENTAGE" : "GRADE";

        if (dtoList == null || dtoList.isEmpty()) {
            throw new BadRequestException("Danh sách thang điểm không được để trống");
        }

        // Xóa cấu hình theo loại (GRADE hoặc PERCENTAGE)
        gradeScaleRepository.deleteAllByExam_IdAndScaleType(examId, scaleType);

        List<ExamGradeScale> entities = new ArrayList<>();
        int order = 1;
        for (GradeScaleDTO dto : dtoList) {
            if (dto.gradeLetter() == null || dto.gradeLetter().isBlank()) {
                throw new BadRequestException("Tên nhãn / Hạng không được để trống");
            }
            if (dto.minScore() == null || dto.maxScore() == null) {
                throw new BadRequestException("Min và Max không được để trống");
            }
            if (dto.minScore().compareTo(dto.maxScore()) > 0) {
                throw new BadRequestException("Min không được lớn hơn Max cho: " + dto.gradeLetter());
            }

            ExamGradeScale scale = new ExamGradeScale();
            scale.setExam(exam);
            scale.setScaleType(scaleType);
            scale.setGradeLetter(dto.gradeLetter().trim());
            scale.setMinScore(dto.minScore());
            scale.setMaxScore(dto.maxScore());
            scale.setLabel(dto.label() != null ? dto.label().trim() : "");
            scale.setColor(dto.color() != null ? dto.color().trim() : "#3b82f6");
            scale.setDisplayOrder(order++);
            entities.add(scale);
        }

        List<ExamGradeScale> saved = gradeScaleRepository.saveAll(entities);
        return saved.stream()
                .map(s -> new GradeScaleDTO(
                        s.getId(),
                        s.getScaleType(),
                        s.getGradeLetter(),
                        s.getMinScore(),
                        s.getMaxScore(),
                        s.getLabel(),
                        s.getColor(),
                        s.getDisplayOrder()
                ))
                .toList();
    }

    @Transactional
    public void resetToDefault(Long examId, String type) {
        String scaleType = (type != null && type.equalsIgnoreCase("PERCENTAGE")) ? "PERCENTAGE" : "GRADE";
        gradeScaleRepository.deleteAllByExam_IdAndScaleType(examId, scaleType);
    }
}
