package com.example.starter_project_2025.system.chatbot;

import com.example.starter_project_2025.system.chatbot.dto.ChatMessageDTO;
import com.example.starter_project_2025.system.chatbot.dto.SystemChatRequest;
import com.example.starter_project_2025.system.chatbot.dto.SystemChatResponse;
import com.example.starter_project_2025.system.demo.aicourse.AiTextClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SystemChatbotServiceTest {

    @Mock
    private AiTextClient aiTextClient;

    private SystemChatbotService service;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        service = new SystemChatbotService(aiTextClient);
        service.init();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void ask_includesBilingualInstructionsAndKnowledgeAndReturnsAiReply() {
        ObjectNode responseNode = objectMapper.createObjectNode();
        responseNode.put("reply", "Go to Project Workspace -> Milestones -> Submit Artifact.");
        responseNode.put("outOfScope", false);

        when(aiTextClient.generateJson(any(), any(), eq(AiTextClient.ANALYSIS_TEMPERATURE)))
                .thenReturn(responseNode);

        SystemChatRequest request = new SystemChatRequest();
        request.setMessage("How do I submit an artifact for a milestone?");
        request.setCurrentPath("/student/projects");
        request.setHistory(List.of(new ChatMessageDTO("user", "Xin chào"), new ChatMessageDTO("assistant", "Chào bạn")));

        SystemChatResponse response = service.ask(request);

        assertEquals("Go to Project Workspace -> Milestones -> Submit Artifact.", response.getReply());
        assertFalse(response.isOutOfScope());

        ArgumentCaptor<String> instructionCaptor = ArgumentCaptor.forClass(String.class);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<AiTextClient.Turn>> turnsCaptor = ArgumentCaptor.forClass(List.class);

        verify(aiTextClient).generateJson(
                instructionCaptor.capture(),
                turnsCaptor.capture(),
                eq(AiTextClient.ANALYSIS_TEMPERATURE)
        );

        String instruction = instructionCaptor.getValue();
        assertTrue(instruction.contains("tiếng Anh"));
        assertTrue(instruction.contains("Sorry, I am an AI assistant"));
        assertTrue(instruction.contains("AI Course Builder"));
        assertTrue(instruction.contains("Recommended Courses"));
        assertTrue(instruction.contains("Certificate"));
        assertTrue(instruction.contains("Milestones & Submissions"));
        assertTrue(instruction.contains("/student/projects"));

        List<AiTextClient.Turn> turns = turnsCaptor.getValue();
        assertEquals(3, turns.size());
        assertEquals("How do I submit an artifact for a milestone?", turns.get(2).text());
    }
}
