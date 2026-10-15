package com.example.starter_project_2025.system.question.service;

import com.example.starter_project_2025.system.question.domain.Difficulty;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.question.dto.QuestionDTO;
import com.opencsv.CSVReader;
import lombok.Getter;
import lombok.Setter;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Component
public class QuestionCsvParser {

    @Getter
    @Setter
    public static class ParsedRow {
        private int rowNumber;
        private QuestionDTO dto;
        private String parseError;

        public ParsedRow(int rowNumber, QuestionDTO dto) {
            this.rowNumber = rowNumber;
            this.dto = dto;
        }

        public ParsedRow(int rowNumber, String parseError) {
            this.rowNumber = rowNumber;
            this.parseError = parseError;
        }

        public boolean hasError() {
            return parseError != null && !parseError.isBlank();
        }
    }

    public List<ParsedRow> parse(InputStream inputStream) {
        List<ParsedRow> results = new ArrayList<>();

        try (CSVReader reader = new CSVReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
            List<String[]> rows = reader.readAll();
            if (rows == null || rows.isEmpty()) {
                return results;
            }

            // Dòng đầu tiên là header
            String[] rawHeaders = rows.get(0);
            Map<String, Integer> headerMap = buildHeaderMap(rawHeaders);

            // Bắt đầu đọc từ dòng thứ 2 (index 1 -> số dòng hiển thị cho người dùng là 2)
            for (int i = 1; i < rows.size(); i++) {
                int rowNumber = i + 1;
                String[] rowData = rows.get(i);

                // Bỏ qua dòng hoàn toàn rỗng
                if (isRowEmpty(rowData)) {
                    continue;
                }

                try {
                    QuestionDTO dto = parseRow(rowData, headerMap);
                    results.add(new ParsedRow(rowNumber, dto));
                } catch (Exception e) {
                    results.add(new ParsedRow(rowNumber, e.getMessage()));
                }
            }

        } catch (Exception e) {
            results.add(new ParsedRow(1, "Lỗi đọc file CSV: " + e.getMessage()));
        }

        return results;
    }

    private QuestionDTO parseRow(String[] row, Map<String, Integer> headerMap) {
        QuestionDTO dto = new QuestionDTO();

        // 1. Content (Nội dung câu hỏi)
        String content = getValue(row, headerMap, "content", "nội dung");
        if (content == null || content.trim().isEmpty()) {
            throw new IllegalArgumentException("Nội dung câu hỏi không được để trống");
        }
        dto.setContent(content.trim());

        // 2. Type (Loại câu hỏi)
        String typeStr = getValue(row, headerMap, "type", "loại câu hỏi", "loại");
        if (typeStr == null || typeStr.trim().isEmpty()) {
            throw new IllegalArgumentException("Loại câu hỏi không được để trống (SINGLE_CHOICE, MULTI_CHOICE, ESSAY)");
        }
        try {
            dto.setType(QuestionType.valueOf(typeStr.trim().toUpperCase()));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Loại câu hỏi [" + typeStr.trim() + "] không hợp lệ. Cho phép: SINGLE_CHOICE, MULTI_CHOICE, ESSAY");
        }

        // 3. Difficulty (Độ khó)
        String diffStr = getValue(row, headerMap, "difficulty", "độ khó");
        if (diffStr == null || diffStr.trim().isEmpty()) {
            throw new IllegalArgumentException("Độ khó không được để trống (EASY, MEDIUM, HARD)");
        }
        try {
            dto.setDifficulty(Difficulty.valueOf(diffStr.trim().toUpperCase()));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Độ khó [" + diffStr.trim() + "] không hợp lệ. Cho phép: EASY, MEDIUM, HARD");
        }

        // 4. Topic (Chủ đề)
        String topic = getValue(row, headerMap, "topic", "chủ đề");
        if (topic != null && !topic.trim().isEmpty()) {
            dto.setTopic(topic.trim().toLowerCase());
        }

        // 5. Points (Điểm)
        String pointsStr = getValue(row, headerMap, "points", "điểm");
        if (pointsStr != null && !pointsStr.trim().isEmpty()) {
            try {
                int points = Integer.parseInt(pointsStr.trim());
                if (points < 1) {
                    throw new IllegalArgumentException("Điểm số phải lớn hơn hoặc bằng 1");
                }
                dto.setPoints(points);
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("Điểm số [" + pointsStr.trim() + "] phải là số nguyên");
            }
        } else {
            dto.setPoints(1);
        }

        // 6. Options (Đáp án từ 1 đến 6)
        List<QuestionDTO.OptionDTO> options = new ArrayList<>();
        for (int optIndex = 1; optIndex <= 6; optIndex++) {
            String optContent = getValue(row, headerMap, "option " + optIndex, "option" + optIndex, "đáp án " + optIndex, "đáp án" + optIndex);
            String correctStr = getValue(row, headerMap, "correct " + optIndex, "correct" + optIndex, "is correct " + optIndex, "đúng " + optIndex);

            if (optContent != null && !optContent.trim().isEmpty()) {
                QuestionDTO.OptionDTO optionDTO = new QuestionDTO.OptionDTO();
                optionDTO.setContent(optContent.trim());
                optionDTO.setCorrect(isTrue(correctStr));
                options.add(optionDTO);
            }
        }
        if (!options.isEmpty() || dto.getType() != QuestionType.ESSAY) {
            dto.setOptions(options.isEmpty() && dto.getType() == QuestionType.ESSAY ? null : options);
        }

        return dto;
    }

    private Map<String, Integer> buildHeaderMap(String[] headers) {
        Map<String, Integer> map = new HashMap<>();
        for (int i = 0; i < headers.length; i++) {
            if (headers[i] != null) {
                String key = cleanHeader(headers[i]);
                map.put(key, i);
            }
        }
        return map;
    }

    private String cleanHeader(String header) {
        if (header == null) return "";
        // Loại bỏ UTF-8 BOM nếu có
        return header.replace("\uFEFF", "").trim().toLowerCase();
    }

    private String getValue(String[] row, Map<String, Integer> headerMap, String... candidateKeys) {
        for (String key : candidateKeys) {
            Integer index = headerMap.get(key.toLowerCase());
            if (index != null && index < row.length) {
                return row[index];
            }
        }
        return null;
    }

    private boolean isTrue(String val) {
        if (val == null) return false;
        String trimmed = val.trim().toLowerCase();
        return trimmed.equals("true") || trimmed.equals("1") || trimmed.equals("yes") 
                || trimmed.equals("y") || trimmed.equals("x") || trimmed.equals("đúng");
    }

    private boolean isRowEmpty(String[] row) {
        if (row == null || row.length == 0) return true;
        for (String s : row) {
            if (s != null && !s.trim().isEmpty()) return false;
        }
        return true;
    }
}
