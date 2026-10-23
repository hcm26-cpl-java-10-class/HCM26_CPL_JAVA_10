package com.example.starter_project_2025.system.question.service;

import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.system.question.domain.Difficulty;
import com.example.starter_project_2025.system.question.domain.Question;
import com.example.starter_project_2025.system.question.domain.QuestionRepository;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.question.dto.QuestionDTO;
import com.example.starter_project_2025.system.question.mapper.QuestionMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class QuestionImportTest {

    private QuestionCsvParser parser;
    private QuestionValidator validator;
    private QuestionMapper mapper;

    @Mock
    private QuestionRepository repository;

    private QuestionImportService importService;

    @BeforeEach
    void setUp() {
        parser = new QuestionCsvParser();
        validator = new QuestionValidator();
        mapper = new QuestionMapper();
        importService = new QuestionImportService(parser, validator, repository, mapper);
    }

    @Test
    @DisplayName("Parser: Parse thành công file CSV mẫu chuẩn")
    void testParser_Success() {
        String csv = "Content,Type,Difficulty,Topic,Points,Option 1,Correct 1,Option 2,Correct 2\n" +
                "\"Câu hỏi 1?\",MULTIPLE_CHOICE,EASY,Java,1,Đáp án A,true,Đáp án B,false\n" +
                "\"Câu hỏi 2 tự luận?\",ESSAY,HARD,Java,5,,,,\n";

        List<QuestionCsvParser.ParsedRow> rows = parser.parse(new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8)));

        assertEquals(2, rows.size());
        assertFalse(rows.get(0).hasError());
        assertEquals("Câu hỏi 1?", rows.get(0).getDto().getContent());
        assertEquals(QuestionType.MULTIPLE_CHOICE, rows.get(0).getDto().getType());
        assertEquals(2, rows.get(0).getDto().getOptions().size());
        assertTrue(rows.get(0).getDto().getOptions().get(0).isCorrect());

        assertFalse(rows.get(1).hasError());
        assertEquals("Câu hỏi 2 tự luận?", rows.get(1).getDto().getContent());
        assertEquals(QuestionType.ESSAY, rows.get(1).getDto().getType());
        assertNull(rows.get(1).getDto().getOptions());
    }

    private static final String SAMPLE_CSV = "Content,Type,Difficulty,Topic,Points,Option 1,Correct 1,Option 2,Correct 2\n" +
            "\"Java là gì?\",MULTIPLE_CHOICE,EASY,Java,1,OOP,true,Thủ tục,false\n" +
            "\"Tính chất OOP?\",MULTI_CHOICE,MEDIUM,Java,2,Đóng gói,true,Kế thừa,true\n" +
            "\"Trình bày Spring Bean?\",ESSAY,HARD,Spring,5,,,,\n";

    @Test
    @DisplayName("Import: Import thành công file mẫu 3 câu và lưu vào CSDL")
    void testImport_Success() {
        MockMultipartFile file = new MockMultipartFile("file", "template.csv", "text/csv", SAMPLE_CSV.getBytes(StandardCharsets.UTF_8));

        when(repository.exists(any(Specification.class))).thenReturn(false);
        when(repository.save(any(Question.class))).thenAnswer(inv -> inv.getArgument(0));

        ImportResult result = importService.importQuestionsFromCsv(file);

        assertEquals(3, result.getSuccessCount());
        assertEquals(0, result.getFailureCount());
        assertTrue(result.getErrors().isEmpty());
        verify(repository, times(3)).save(any(Question.class));
    }

    @Test
    @DisplayName("Chống tạo trùng: Chạy lại lần 2 không lưu thêm câu hỏi, báo rõ dòng bị trùng")
    void testImport_PreventDuplicatesOnRerun() {
        MockMultipartFile file = new MockMultipartFile("file", "template.csv", "text/csv", SAMPLE_CSV.getBytes(StandardCharsets.UTF_8));

        // Giả lập câu hỏi đã tồn tại trong CSDL
        when(repository.exists(any(Specification.class))).thenReturn(true);

        ImportResult result = importService.importQuestionsFromCsv(file);

        assertEquals(0, result.getSuccessCount());
        assertEquals(3, result.getFailureCount());
        assertEquals(3, result.getErrors().size());
        assertTrue(result.getErrors().get(0).getMessage().contains("không tạo trùng"));
        verify(repository, never()).save(any(Question.class));
    }

    @Test
    @DisplayName("Báo lỗi dòng rõ ràng: Kiểm tra validation (MULTIPLE_CHOICE không có đáp án đúng, ESSAY có đáp án)")
    void testImport_ReportDetailedRowErrors() {
        String csv = "Content,Type,Difficulty,Topic,Points,Option 1,Correct 1,Option 2,Correct 2\n" +
                // Dòng 2: MULTIPLE_CHOICE nhưng cả 2 đáp án đều false -> Lỗi
                "\"Câu trắc nghiệm sai?\",MULTIPLE_CHOICE,EASY,Java,1,Đáp án 1,false,Đáp án 2,false\n" +
                // Dòng 3: ESSAY nhưng lại gửi đáp án -> Lỗi
                "\"Câu tự luận có đáp án?\",ESSAY,MEDIUM,Java,2,Đáp án thừa,true,,\n";

        MockMultipartFile file = new MockMultipartFile("file", "test.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));
        when(repository.exists(any(Specification.class))).thenReturn(false);

        ImportResult result = importService.importQuestionsFromCsv(file);

        assertEquals(0, result.getSuccessCount());
        assertEquals(2, result.getFailureCount());
        assertEquals(2, result.getErrors().size());

        // Kiểm tra dòng 2 báo đúng lỗi của QuestionValidator
        assertEquals(2, result.getErrors().get(0).getRowNumber());
        assertTrue(result.getErrors().get(0).getMessage().contains("Cần ít nhất 1 đáp án đúng"),
                "Lỗi thực tế: " + result.getErrors().get(0).getMessage());

        // Kiểm tra dòng 3 báo đúng lỗi của QuestionValidator
        assertEquals(3, result.getErrors().get(1).getRowNumber());
        assertTrue(result.getErrors().get(1).getMessage().contains("Câu tự luận không có đáp án"));
    }
}
