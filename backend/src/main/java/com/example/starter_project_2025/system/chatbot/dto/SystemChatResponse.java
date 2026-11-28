package com.example.starter_project_2025.system.chatbot.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class SystemChatResponse {
    private String reply;
    private boolean outOfScope;
}