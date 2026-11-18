package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.exam.controller.ExamPasswordController;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.dto.ExamPasswordVerifyRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExamPasswordTest {

    @Mock
    private ExamRepository examRepository;

    private ExamPasswordController controller;

    @BeforeEach
    void setUp() {
        controller = new ExamPasswordController(examRepository);
    }

    @Test
    @DisplayName("Đề thi không có mật khẩu thì luôn cho qua")
    void verifyPasswordWhenNoPasswordConfigured() {
        Exam exam = new Exam();
        exam.setId(10L);
        exam.setIsActive(true);
        exam.setAccessCode(null);

        when(examRepository.findById(10L)).thenReturn(Optional.of(exam));

        ExamPasswordVerifyRequest req = new ExamPasswordVerifyRequest();
        req.setPassword("anything");

        ResponseEntity<Map<String, Object>> response = controller.verifyPassword(10L, req);
        assertEquals(200, response.getStatusCode().value());
        assertEquals(true, response.getBody().get("valid"));
    }

    @Test
    @DisplayName("Nhập đúng mật khẩu đề thi thì thành công")
    void verifyPasswordCorrect() {
        Exam exam = new Exam();
        exam.setId(10L);
        exam.setIsActive(true);
        exam.setAccessCode("SECRET123");

        when(examRepository.findById(10L)).thenReturn(Optional.of(exam));

        ExamPasswordVerifyRequest req = new ExamPasswordVerifyRequest();
        req.setPassword("SECRET123");

        ResponseEntity<Map<String, Object>> response = controller.verifyPassword(10L, req);
        assertEquals(200, response.getStatusCode().value());
        assertEquals(true, response.getBody().get("valid"));
    }

    @Test
    @DisplayName("Nhập sai mật khẩu đề thi thì ném ra BadRequestException")
    void verifyPasswordWrongThrowsException() {
        Exam exam = new Exam();
        exam.setId(10L);
        exam.setIsActive(true);
        exam.setAccessCode("SECRET123");

        when(examRepository.findById(10L)).thenReturn(Optional.of(exam));

        ExamPasswordVerifyRequest req = new ExamPasswordVerifyRequest();
        req.setPassword("WRONG_PASS");

        BadRequestException ex = assertThrows(BadRequestException.class, () -> controller.verifyPassword(10L, req));
        assertEquals("Mật khẩu đề thi không chính xác", ex.getMessage());
    }
}
