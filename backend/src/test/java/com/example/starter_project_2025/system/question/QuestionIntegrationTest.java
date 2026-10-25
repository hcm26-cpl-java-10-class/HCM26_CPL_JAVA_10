package com.example.starter_project_2025.system.question;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.question.domain.Difficulty;
import com.example.starter_project_2025.system.question.domain.Question;
import com.example.starter_project_2025.system.question.domain.QuestionOption;
import com.example.starter_project_2025.system.question.domain.QuestionRepository;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.question.dto.QuestionDTO;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@org.springframework.test.context.ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
public class QuestionIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private ExamRepository examRepository;

    @Autowired
    private org.springframework.security.core.userdetails.UserDetailsService userDetailsService;

    @Autowired
    private org.springframework.transaction.support.TransactionTemplate transactionTemplate;

    private String adminToken;
    private String studentToken;

    @BeforeEach
    void setUp() {
        transactionTemplate.executeWithoutResult(status -> {
            org.springframework.security.core.userdetails.UserDetails admin = userDetailsService.loadUserByUsername("admin@example.com");
            adminToken = refreshTokenService.generateAccessToken(
                    new UsernamePasswordAuthenticationToken(admin, null, admin.getAuthorities())
            );

            org.springframework.security.core.userdetails.UserDetails student = userDetailsService.loadUserByUsername("student@example.com");
            studentToken = refreshTokenService.generateAccessToken(
                    new UsernamePasswordAuthenticationToken(student, null, student.getAuthorities())
            );
        });
    }

    @Test
    @DisplayName("POST /api/questions - Tạo câu hỏi Single Choice hợp lệ thành công (200)")
    void createSingleChoiceQuestion_Success() throws Exception {
        QuestionDTO dto = new QuestionDTO();
        dto.setContent("Ngon ngu Java ra doi nam nao?");
        dto.setType(QuestionType.SINGLE_CHOICE);
        dto.setDifficulty(Difficulty.EASY);
        dto.setTopic("Java Basics");
        dto.setPoints(1);
        dto.setIsActive(true);

        QuestionDTO.OptionDTO o1 = new QuestionDTO.OptionDTO();
        o1.setContent("1995");
        o1.setCorrect(true);

        QuestionDTO.OptionDTO o2 = new QuestionDTO.OptionDTO();
        o2.setContent("1991");
        o2.setCorrect(false);

        QuestionDTO.OptionDTO o3 = new QuestionDTO.OptionDTO();
        o3.setContent("2000");
        o3.setCorrect(false);

        dto.setOptions(List.of(o1, o2, o3));

        mockMvc.perform(post("/api/questions")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.content").value("Ngon ngu Java ra doi nam nao?"))
                .andExpect(jsonPath("$.options", hasSize(3)));
    }

    @Test
    @DisplayName("POST /api/questions - Báo lỗi khi Single Choice không có hoặc có nhiều hơn 1 đáp án đúng (400)")
    void createSingleChoice_InvalidCorrectOptionCount_ReturnsBadRequest() throws Exception {
        QuestionDTO dto = new QuestionDTO();
        dto.setContent("Cau hoi 1 dap an nhung khong co dap an dung");
        dto.setType(QuestionType.SINGLE_CHOICE);
        dto.setDifficulty(Difficulty.MEDIUM);
        dto.setTopic("Testing");
        dto.setIsActive(true);

        QuestionDTO.OptionDTO o1 = new QuestionDTO.OptionDTO();
        o1.setContent("Dap an A");
        o1.setCorrect(false);

        QuestionDTO.OptionDTO o2 = new QuestionDTO.OptionDTO();
        o2.setContent("Dap an B");
        o2.setCorrect(false);

        dto.setOptions(List.of(o1, o2));

        mockMvc.perform(post("/api/questions")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.options", hasItem("Câu 1 đáp án phải có đúng 1 đáp án đúng")));
    }

    @Test
    @DisplayName("POST /api/questions - Báo lỗi khi số đáp án ít hơn 2 hoặc nhiều hơn 6 (400)")
    void createQuestion_InvalidOptionCount_ReturnsBadRequest() throws Exception {
        QuestionDTO dto = new QuestionDTO();
        dto.setContent("Cau hoi chi co 1 dap an");
        dto.setType(QuestionType.SINGLE_CHOICE);
        dto.setDifficulty(Difficulty.EASY);
        dto.setTopic("Testing");
        dto.setIsActive(true);

        QuestionDTO.OptionDTO o1 = new QuestionDTO.OptionDTO();
        o1.setContent("Dap an duy nhat");
        o1.setCorrect(true);

        dto.setOptions(List.of(o1));

        mockMvc.perform(post("/api/questions")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.options", hasItem("Số đáp án phải từ 2 đến 6")));
    }

    @Test
    @DisplayName("POST /api/questions - Báo lỗi khi nội dung các đáp án bị trùng lặp (400)")
    void createQuestion_DuplicateOptions_ReturnsBadRequest() throws Exception {
        QuestionDTO dto = new QuestionDTO();
        dto.setContent("Cau hoi co dap an trung nhau");
        dto.setType(QuestionType.SINGLE_CHOICE);
        dto.setDifficulty(Difficulty.EASY);
        dto.setTopic("Testing");
        dto.setIsActive(true);

        QuestionDTO.OptionDTO o1 = new QuestionDTO.OptionDTO();
        o1.setContent("Dap an A");
        o1.setCorrect(true);

        QuestionDTO.OptionDTO o2 = new QuestionDTO.OptionDTO();
        o2.setContent("Dap an A");
        o2.setCorrect(false);

        dto.setOptions(List.of(o1, o2));

        mockMvc.perform(post("/api/questions")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.options", hasItem("Các đáp án không được trùng nhau")));
    }

    @Test
    @DisplayName("GET /api/questions - Tìm kiếm câu hỏi theo search keyword (200)")
    void searchQuestions_ReturnsMatchingResults() throws Exception {
        Question q = new Question();
        q.setContent("Tim kiem tu khoa SpringBootDatabases");
        q.setType(QuestionType.SINGLE_CHOICE);
        q.setDifficulty(Difficulty.HARD);
        q.setTopic("Spring Framework");
        q.setPoints(2);
        q.setIsActive(true);

        QuestionOption opt1 = new QuestionOption();
        opt1.setContent("Option 1");
        opt1.setCorrect(true);
        opt1.setQuestion(q);

        QuestionOption opt2 = new QuestionOption();
        opt2.setContent("Option 2");
        opt2.setCorrect(false);
        opt2.setQuestion(q);

        q.setOptions(new ArrayList<>(List.of(opt1, opt2)));
        questionRepository.save(q);

        mockMvc.perform(get("/api/questions")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("search", "SpringBootDatabases"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.content[0].content").value(containsString("SpringBootDatabases")));
    }

    @Test
    @DisplayName("DELETE /api/questions/{id} - Từ chối xóa khi câu hỏi đang được dùng trong đề thi (400)")
    void deleteQuestion_WhenUsedInExam_ReturnsBadRequest() throws Exception {
        Question q = new Question();
        q.setContent("Cau hoi thuoc ve de thi");
        q.setType(QuestionType.SINGLE_CHOICE);
        q.setDifficulty(Difficulty.EASY);
        q.setPoints(1);
        q.setIsActive(true);

        QuestionOption opt1 = new QuestionOption();
        opt1.setContent("A");
        opt1.setCorrect(true);
        opt1.setQuestion(q);

        QuestionOption opt2 = new QuestionOption();
        opt2.setContent("B");
        opt2.setCorrect(false);
        opt2.setQuestion(q);

        q.setOptions(new ArrayList<>(List.of(opt1, opt2)));
        Question savedQ = questionRepository.save(q);

        Exam exam = new Exam();
        exam.setTitle("De thi toan tap");
        exam.setDurationMinutes(45);
        exam.setIsActive(true);
        exam.setQuestions(new HashSet<>(Set.of(savedQ)));
        examRepository.save(exam);

        mockMvc.perform(delete("/api/questions/" + savedQ.getId())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.question", hasItem("Câu hỏi đang được dùng trong đề thi, không thể xóa")));
    }

    @Test
    @DisplayName("POST /api/questions - Người dùng không có quyền (STUDENT) bị từ chối 403 Forbidden")
    void createQuestion_AsStudent_ReturnsForbidden() throws Exception {
        QuestionDTO dto = new QuestionDTO();
        dto.setContent("Cau hoi do hoc sinh tao");
        dto.setType(QuestionType.SINGLE_CHOICE);
        dto.setDifficulty(Difficulty.EASY);
        dto.setIsActive(true);

        QuestionDTO.OptionDTO o1 = new QuestionDTO.OptionDTO();
        o1.setContent("A");
        o1.setCorrect(true);
        QuestionDTO.OptionDTO o2 = new QuestionDTO.OptionDTO();
        o2.setContent("B");
        o2.setCorrect(false);
        dto.setOptions(List.of(o1, o2));

        mockMvc.perform(post("/api/questions")
                        .header("Authorization", "Bearer " + studentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isForbidden());
    }
}
