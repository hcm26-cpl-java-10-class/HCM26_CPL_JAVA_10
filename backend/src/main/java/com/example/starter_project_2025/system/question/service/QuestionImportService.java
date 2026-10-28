package com.example.starter_project_2025.system.question.service;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.base.dataio.importer.result.RowError;
import com.example.starter_project_2025.system.question.domain.Question;
import com.example.starter_project_2025.system.question.domain.QuestionRepository;
import com.example.starter_project_2025.system.question.dto.QuestionDTO;
import com.example.starter_project_2025.system.question.mapper.QuestionMapper;
import jakarta.persistence.criteria.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
public class QuestionImportService {

    private final QuestionCsvParser csvParser;
    private final QuestionValidator questionValidator;
    private final QuestionRepository questionRepository;
    private final QuestionMapper questionMapper;

    public QuestionImportService(
            QuestionCsvParser csvParser,
            QuestionValidator questionValidator,
            QuestionRepository questionRepository,
            QuestionMapper questionMapper) {
        this.csvParser = csvParser;
        this.questionValidator = questionValidator;
        this.questionRepository = questionRepository;
        this.questionMapper = questionMapper;
    }

    @Transactional
    public ImportResult importQuestionsFromCsv(MultipartFile file) {
        ImportResult result = new ImportResult();

        if (file == null || file.isEmpty()) {
            result.getErrors().add(new RowError(0, "File tải lên không được để trống"));
            result.setFailureCount(1);
            return result;
        }

        String originalFilename = file.getOriginalFilename();
        boolean isCsv = originalFilename != null && originalFilename.toLowerCase().endsWith(".csv");
        boolean isExcel = originalFilename != null && (originalFilename.toLowerCase().endsWith(".xlsx") || originalFilename.toLowerCase().endsWith(".xls"));

        if (!isCsv && !isExcel) {
            result.getErrors().add(new RowError(0, "Hệ thống hỗ trợ định dạng file Excel (.xlsx, .xls) và CSV (.csv)"));
            result.setFailureCount(1);
            return result;
        }

        List<QuestionCsvParser.ParsedRow> rows;
        try {
            if (isExcel) {
                rows = csvParser.parseExcel(file.getInputStream());
            } else {
                rows = csvParser.parse(file.getInputStream());
            }
        } catch (Exception e) {
            log.error("Lỗi khi đọc file câu hỏi", e);
            result.getErrors().add(new RowError(0, "Không thể đọc nội dung file: " + e.getMessage()));
            result.setFailureCount(1);
            return result;
        }

        if (rows.isEmpty()) {
            result.getErrors().add(new RowError(1, "File không chứa dòng dữ liệu nào hợp lệ"));
            result.setFailureCount(1);
            return result;
        }

        List<QuestionDTO> validDtos = new ArrayList<>();
        Set<String> seenInFile = new HashSet<>();

        for (QuestionCsvParser.ParsedRow row : rows) {
            int rowNumber = row.getRowNumber();

            if (row.hasError()) {
                result.getErrors().add(new RowError(rowNumber, row.getParseError()));
                result.setFailureCount(result.getFailureCount() + 1);
                continue;
            }

            QuestionDTO dto = row.getDto();

            String contentKey = buildUniqueKey(dto.getContent(), dto.getTopic());
            if (!seenInFile.add(contentKey)) {
                result.getErrors().add(new RowError(rowNumber, "Câu hỏi bị trùng lặp nội dung với một dòng khác trong cùng file"));
                result.setFailureCount(result.getFailureCount() + 1);
                continue;
            }

            if (isDuplicateInDatabase(dto.getContent(), dto.getTopic())) {
                result.getErrors().add(new RowError(rowNumber, "Câu hỏi đã tồn tại trong hệ thống (trùng nội dung và chủ đề)"));
                result.setFailureCount(result.getFailureCount() + 1);
                continue;
            }

            ValidationContext ctx = new ValidationContext();
            questionValidator.validateForCreate(dto, ctx);

            if (ctx.hasErrors()) {
                StringBuilder errorMsg = new StringBuilder();
                ctx.getErrors().forEach((field, messages) -> {
                    if (!errorMsg.isEmpty()) errorMsg.append("; ");
                    errorMsg.append(field).append(": ").append(String.join(", ", messages));
                });
                result.getErrors().add(new RowError(rowNumber, errorMsg.toString()));
                result.setFailureCount(result.getFailureCount() + 1);
                continue;
            }

            validDtos.add(dto);
        }

        if (!result.getErrors().isEmpty()) {
            log.warn("Import bị hủy (Rollback): phát hiện {} dòng lỗi trong file '{}'", result.getFailureCount(), originalFilename);
            return result;
        }

        for (QuestionDTO dto : validDtos) {
            try {
                Question question = questionMapper.toEntity(dto);
                questionRepository.save(question);
                result.setSuccessCount(result.getSuccessCount() + 1);
            } catch (Exception e) {
                log.error("Lỗi khi lưu câu hỏi vào CSDL — rollback toàn bộ import", e);
                throw new RuntimeException("Lỗi khi lưu vào CSDL: " + e.getMessage(), e);
            }
        }

        log.info("Import thành công {} câu hỏi từ file '{}'", result.getSuccessCount(), originalFilename);
        return result;
    }

    private boolean isDuplicateInDatabase(String content, String topic) {
        if (content == null || content.isBlank()) return false;
        String trimmedContent = content.trim().toLowerCase();
        String normalizedTopic = (topic != null && !topic.isBlank()) ? topic.trim().toLowerCase() : null;

        return questionRepository.exists((root, query, cb) -> {
            Predicate bankOnly = cb.isNull(root.get("sourceQuestionId"));
            Predicate contentPredicate = cb.and(bankOnly, cb.equal(cb.lower(cb.trim(root.get("content"))), trimmedContent));
            if (normalizedTopic != null) {
                Predicate topicPredicate = cb.equal(cb.lower(cb.trim(root.get("topic"))), normalizedTopic);
                return cb.and(contentPredicate, topicPredicate);
            } else {
                Predicate topicNullOrEmpty = cb.or(cb.isNull(root.get("topic")), cb.equal(cb.trim(root.get("topic")), ""));
                return cb.and(contentPredicate, topicNullOrEmpty);
            }
        });
    }

    private String buildUniqueKey(String content, String topic) {
        String c = content != null ? content.trim().toLowerCase() : "";
        String t = topic != null ? topic.trim().toLowerCase() : "";
        return c + "###" + t;
    }
}
