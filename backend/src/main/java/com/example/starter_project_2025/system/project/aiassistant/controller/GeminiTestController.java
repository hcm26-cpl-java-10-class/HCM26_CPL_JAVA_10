package com.example.starter_project_2025.system.project.aiassistant.controller;

import com.example.starter_project_2025.system.project.aiassistant.provider.LlmProvider;
import com.example.starter_project_2025.system.project.aiassistant.provider.LlmRequest;
import com.example.starter_project_2025.system.project.aiassistant.provider.LlmResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai/template-assistant/test")
@RequiredArgsConstructor
public class GeminiTestController {

    private final LlmProvider llmProvider;

    @PostMapping
    public LlmResponse testGemini(@RequestBody LlmRequest request) {
        return llmProvider.generate(request);
    }
}
