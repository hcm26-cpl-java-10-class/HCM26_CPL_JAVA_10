package com.example.starter_project_2025.system.chatbot.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import java.util.List;

@Data
public class SystemChatRequest {
    @NotBlank(message = "Nội dung tin nhắn không được để trống")
    private String message;
    private String currentPath; // VD: "/management/exam" hoặc "/student/projects"
    private List<ChatMessageDTO> history; // Tối đa 6 tin nhắn gần nhất
}