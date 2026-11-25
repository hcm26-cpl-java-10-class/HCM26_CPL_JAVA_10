package com.example.starter_project_2025.system.chatbot;

import com.example.starter_project_2025.system.chatbot.dto.SystemChatRequest;
import com.example.starter_project_2025.system.chatbot.dto.SystemChatResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/chatbot")
@RequiredArgsConstructor
public class SystemChatbotController {

    private final SystemChatbotService chatbotService;

    @PostMapping("/ask")
    public ResponseEntity<SystemChatResponse> ask(@Valid @RequestBody SystemChatRequest request) {
        return ResponseEntity.ok(chatbotService.ask(request));
    }
}