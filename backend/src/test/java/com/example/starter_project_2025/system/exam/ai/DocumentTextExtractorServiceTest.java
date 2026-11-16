package com.example.starter_project_2025.system.exam.ai;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.exam.ai.AiQuestionGeneratorDTO.DocumentExtractResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DocumentTextExtractorServiceTest {

    private final DocumentTextExtractorService extractorService = new DocumentTextExtractorService();

    @Test
    @DisplayName("extractText: successfully extracts plain text file")
    void extractText_txt() {
        String content = "Chương 1: Lập trình Hướng đối tượng\nTính kế thừa, đóng gói, đa hình và trừu tượng.";
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "lecture1.txt",
                "text/plain",
                content.getBytes(StandardCharsets.UTF_8)
        );

        DocumentExtractResponse res = extractorService.extractText(file);

        assertThat(res.getStatus()).isEqualTo("SUCCESS");
        assertThat(res.getFileName()).isEqualTo("lecture1.txt");
        assertThat(res.getExtractedText()).contains("Lập trình Hướng đối tượng");
        assertThat(res.getCharCount()).isEqualTo(content.length());
    }

    @Test
    @DisplayName("extractText: throws BadRequestException for unsupported file format")
    void extractText_unsupportedFormat() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "presentation.exe",
                "application/octet-stream",
                "binary content".getBytes(StandardCharsets.UTF_8)
        );

        assertThatThrownBy(() -> extractorService.extractText(file))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("không được hỗ trợ");
    }

    @Test
    @DisplayName("extractText: throws BadRequestException for empty file")
    void extractText_emptyFile() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "empty.txt",
                "text/plain",
                new byte[0]
        );

        assertThatThrownBy(() -> extractorService.extractText(file))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("rỗng");
    }
}
