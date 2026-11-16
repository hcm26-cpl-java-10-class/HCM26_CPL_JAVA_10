package com.example.starter_project_2025.system.exam.service.ai;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamQuestionGradingConfig;
import com.example.starter_project_2025.system.exam.domain.ExamQuestionGradingConfigRepository;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.domain.ExamType;
import com.example.starter_project_2025.system.exam.dto.AiQuestionGeneratorDTO.*;
import com.example.starter_project_2025.system.exam.service.ExamServiceImpl;
import com.example.starter_project_2025.system.exam.service.ExamTypePolicy;
import com.example.starter_project_2025.system.question.domain.Difficulty;
import com.example.starter_project_2025.system.question.domain.Question;
import com.example.starter_project_2025.system.question.domain.QuestionRepository;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.question.dto.CodeSpecDTO;
import com.example.starter_project_2025.system.question.dto.QuestionDTO;
import com.example.starter_project_2025.system.question.mapper.QuestionMapper;
import com.example.starter_project_2025.system.question.service.CodeSpecSupport;
import com.example.starter_project_2025.system.question.service.QuestionServiceImpl;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiQuestionGeneratorService {

    private final AiGradingProperties properties;
    private final ObjectMapper objectMapper;
    private final ExamRepository examRepository;
    private final ExamServiceImpl examService;
    private final QuestionServiceImpl questionService;
    private final QuestionRepository questionRepository;
    private final QuestionMapper questionMapper;
    private final ExamAttemptRepository examAttemptRepository;
    private final ExamQuestionGradingConfigRepository gradingConfigRepository;

    public GeneratorStatusResponse getStatus() {
        boolean configured = properties.isEnabled() && properties.getApiKey() != null && !properties.getApiKey().isBlank();
        String provider = configured ? "GEMINI" : "FALLBACK";
        String model = configured ? properties.getModel() : "Rule-based Academic Fallback";
        String message = configured
                ? "Google Gemini API đang hoạt động (Model: " + properties.getModel() + ")"
                : "Chưa cấu hình GEMINI_API_KEY. Hệ thống đang sử dụng chế độ Fallback mô phỏng câu hỏi học thuật.";

        return GeneratorStatusResponse.builder()
                .enabled(properties.isEnabled())
                .configured(configured)
                .provider(provider)
                .model(model)
                .message(message)
                .build();
    }

    public GenerateResponse generateQuestions(GenerateRequest req) {
        validateGenerateRequest(req);

        boolean isConfigured = properties.isEnabled() && properties.getApiKey() != null && !properties.getApiKey().isBlank();

        if (isConfigured) {
            try {
                return callGeminiGenerate(req);
            } catch (Exception e) {
                log.warn("Gemini question generation failed, falling back to local academic generator: {}", e.getMessage());
                GenerateResponse fallback = generateLocalFallback(req);
                fallback.setMessage("Google Gemini gặp lỗi (" + e.getMessage() + "). Đã tự động kích hoạt Chế độ Fallback tạo câu hỏi mẫu.");
                return fallback;
            }
        } else {
            return generateLocalFallback(req);
        }
    }

    public GeneratedQuestion regenerateSingle(RegenerateSingleRequest req) {
        if (req.getQuestion() == null) {
            throw new BadRequestException("Dữ liệu câu hỏi cần tạo lại không hợp lệ.");
        }

        boolean isConfigured = properties.isEnabled() && properties.getApiKey() != null && !properties.getApiKey().isBlank();
        if (isConfigured) {
            try {
                return callGeminiRegenerateSingle(req);
            } catch (Exception e) {
                log.warn("Gemini regenerate single failed: {}", e.getMessage());
            }
        }

        return generateSingleFallback(req.getQuestion(), req.getInstruction(), req.getTopic(), req.getLanguage());
    }

    @Transactional
    public CommitToExamResponse commitToExam(CommitToExamRequest req) {
        if (req.getQuestions() == null || req.getQuestions().isEmpty()) {
            throw new BadRequestException("Danh sách câu hỏi cần thêm vào đề thi rỗng.");
        }

        if (req.getExamId() == null || req.getExamId() <= 0) {
            throw new BadRequestException("Cần cung cấp mã đề thi (examId) hợp lệ để lưu câu hỏi AI.");
        }

        Exam exam = examRepository.findById(req.getExamId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài thi với ID: " + req.getExamId()));

        if (examAttemptRepository.existsByExam_Id(exam.getId())) {
            throw new BadRequestException("Bài thi đã có học sinh làm bài, không thể thêm câu hỏi mới.");
        }

        List<Long> createdQuestionIds = new ArrayList<>();

        ExamType effExamType = ExamTypePolicy.determineEffective(exam);
        for (GeneratedQuestion gq : req.getQuestions()) {
            if (!ExamTypePolicy.allows(effExamType, gq.getType())) {
                throw new BadRequestException("Định dạng đề thi là " + ExamTypePolicy.describe(effExamType)
                        + ". Không được phép lưu câu hỏi loại " + gq.getType() + " vào đề thi này.");
            }

            QuestionDTO dto = new QuestionDTO();
            dto.setContent(gq.getContent());
            dto.setType(gq.getType());
            dto.setDifficulty(gq.getDifficulty() != null ? gq.getDifficulty() : Difficulty.MEDIUM);
            dto.setTopic(gq.getTopic() != null ? gq.getTopic() : exam.getTitle());
            dto.setPoints(1);
            dto.setIsActive(true);
            dto.setSource("AI_GENERATED");
            dto.setExamId(exam.getId());
            dto.setIsAiGenerated(true);

            if (gq.getType() == QuestionType.MULTIPLE_CHOICE) {
                List<QuestionDTO.OptionDTO> options = new ArrayList<>();
                for (OptionItem opt : gq.getOptions()) {
                    QuestionDTO.OptionDTO o = new QuestionDTO.OptionDTO();
                    o.setContent(opt.getContent());
                    o.setCorrect(opt.isCorrect());
                    options.add(o);
                }
                dto.setOptions(options);
            } else if (gq.getType() == QuestionType.ESSAY) {
                if (gq.getGradingCriteria() != null && !gq.getGradingCriteria().isEmpty()) {
                    List<QuestionDTO.EssayCriterionDTO> criteria = new ArrayList<>();
                    for (GradingCriterionItem item : gq.getGradingCriteria()) {
                        QuestionDTO.EssayCriterionDTO c = new QuestionDTO.EssayCriterionDTO();
                        c.setName(item.getName());
                        c.setDescription(item.getDescription());
                        c.setWeightPercentage(item.getWeightPercentage());
                        criteria.add(c);
                    }
                    dto.setGradingCriteria(criteria);
                }
            } else if (gq.getType() == QuestionType.CODING) {
                if (gq.getCode() != null) {
                    dto.setCode(gq.getCode());
                }
            }

            QuestionDTO created = questionService.create(dto);
            Long questionId = created.getId();
            createdQuestionIds.add(questionId);

            // If it is an Essay question with reference answer/rubric, store in ExamQuestionGradingConfig
            if (gq.getType() == QuestionType.ESSAY) {
                if ((gq.getReferenceAnswer() != null && !gq.getReferenceAnswer().isBlank())
                        || (gq.getRubric() != null && !gq.getRubric().isBlank())) {
                    saveGradingConfig(exam.getId(), questionId, gq.getReferenceAnswer(), gq.getRubric());
                }
            }
        }

        if (!createdQuestionIds.isEmpty()) {
            examService.addQuestions(exam.getId(), createdQuestionIds);
        }

        return CommitToExamResponse.builder()
                .examId(req.getExamId())
                .addedCount(createdQuestionIds.size())
                .questionIds(createdQuestionIds)
                .message("Đã lưu thành công " + createdQuestionIds.size() + " câu hỏi AI vào bài thi.")
                .build();
    }

    @Transactional
    public List<QuestionDTO> getExamAiQuestions(Long examId) {
        if (examId == null || examId <= 0) {
            throw new BadRequestException("examId không hợp lệ.");
        }
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài thi với ID: " + examId));

        // If exam has attempts or is locked, clean up unused/temporary AI questions automatically
        if (examAttemptRepository.existsByExam_Id(examId)) {
            cleanupUnusedAiQuestions(examId);
        }

        List<Question> questions = questionRepository.findByExamIdAndSource(examId, "AI_GENERATED");
        return questions.stream()
                .map(questionMapper::toResponse)
                .toList();
    }

    @Transactional
    public void deleteAiQuestionPermanently(Long examId, Long questionId) {
        if (examId == null || examId <= 0 || questionId == null || questionId <= 0) {
            throw new BadRequestException("examId hoặc questionId không hợp lệ.");
        }
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài thi với ID: " + examId));

        if (examAttemptRepository.existsByExam_Id(examId)) {
            throw new BadRequestException("Bài thi đã có học sinh làm bài, không thể xóa vĩnh viễn câu hỏi AI.");
        }

        Question q = questionRepository.findById(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy câu hỏi với ID: " + questionId));

        if (!Objects.equals(q.getExamId(), examId) || !"AI_GENERATED".equalsIgnoreCase(q.getSource())) {
            throw new BadRequestException("Câu hỏi này không phải là câu hỏi AI của bài thi " + examId);
        }

        // If attached to exam, detach first
        boolean removed = exam.getQuestions().removeIf(item -> Objects.equals(item.getId(), questionId));
        if (removed) {
            examRepository.save(exam);
        }

        gradingConfigRepository.deleteByExamIdAndQuestionId(examId, questionId);
        questionRepository.delete(q);
        log.info("Permanently deleted AI question {} from exam {}", questionId, examId);
    }

    @Transactional
    public int cleanupUnusedAiQuestions(Long examId) {
        if (examId == null || examId <= 0) {
            return 0;
        }
        Exam exam = examRepository.findById(examId).orElse(null);
        if (exam == null) {
            return 0;
        }

        Set<Long> inExamIds = exam.getQuestions().stream()
                .map(Question::getId)
                .collect(Collectors.toSet());

        List<Question> aiQuestions = questionRepository.findByExamIdAndSource(examId, "AI_GENERATED");
        List<Question> unused = aiQuestions.stream()
                .filter(q -> !inExamIds.contains(q.getId()))
                .toList();

        for (Question q : unused) {
            gradingConfigRepository.deleteByExamIdAndQuestionId(examId, q.getId());
            questionRepository.delete(q);
        }

        log.info("Cleaned up {} unused AI questions for exam {}", unused.size(), examId);
        return unused.size();
    }

    private void saveGradingConfig(Long examId, Long questionId, String referenceAnswer, String rubric) {
        try {
            ExamQuestionGradingConfig config = gradingConfigRepository
                    .findByExamIdAndQuestionId(examId, questionId)
                    .orElseGet(() -> ExamQuestionGradingConfig.builder()
                            .examId(examId)
                            .questionId(questionId)
                            .build());

            if (referenceAnswer != null && !referenceAnswer.isBlank()) {
                config.setReferenceAnswer(referenceAnswer.trim());
                config.setReferenceSubmittedAt(Instant.now());
            }
            if (rubric != null && !rubric.isBlank()) {
                config.setRubric(rubric.trim());
                config.setRubricSubmittedAt(Instant.now());
            }
            gradingConfigRepository.save(config);
        } catch (Exception e) {
            log.warn("Failed to save ExamQuestionGradingConfig for exam {} question {}: {}", examId, questionId, e.getMessage());
        }
    }

    private void validateGenerateRequest(GenerateRequest req) {
        if (req == null) {
            throw new BadRequestException("Yêu cầu tạo câu hỏi không hợp lệ.");
        }
        boolean hasPrompt = req.getPrompt() != null && !req.getPrompt().trim().isEmpty();
        boolean hasDocument = req.getDocumentContent() != null && !req.getDocumentContent().trim().isEmpty();

        if (!hasPrompt && !hasDocument) {
            throw new BadRequestException("Vui lòng cung cấp mô tả yêu cầu hoặc nội dung tài liệu giảng dạy để AI tạo câu hỏi.");
        }

        if (req.getRequests() == null || req.getRequests().isEmpty()) {
            throw new BadRequestException("Vui lòng chọn ít nhất một loại câu hỏi và số lượng cần tạo.");
        }

        int totalCount = req.getRequests().stream().mapToInt(QuestionTypeRequestItem::getCount).sum();
        if (totalCount < 1 || totalCount > 30) {
            throw new BadRequestException("Tổng số lượng câu hỏi trong một lần tạo phải từ 1 đến 30 câu.");
        }

        if (req.getExamId() != null && req.getExamId() > 0) {
            Exam exam = examRepository.findById(req.getExamId()).orElse(null);
            if (exam != null) {
                ExamType effType = ExamTypePolicy.determineEffective(exam);
                for (QuestionTypeRequestItem item : req.getRequests()) {
                    if (!ExamTypePolicy.allows(effType, item.getType())) {
                        throw new BadRequestException("Định dạng đề thi là " + ExamTypePolicy.describe(effType)
                                + ". Không được phép tạo câu hỏi loại " + item.getType());
                    }
                }
            }
        }
    }

    private GenerateResponse callGeminiGenerate(GenerateRequest req) throws Exception {
        RestTemplate restTemplate = buildRestTemplate();
        String systemInstruction = buildSystemPrompt();
        String userPrompt = buildUserPrompt(req);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-goog-api-key", properties.getApiKey().trim());

        Map<String, Object> requestBody = Map.of(
                "systemInstruction", Map.of(
                        "parts", List.of(Map.of("text", systemInstruction))
                ),
                "contents", List.of(
                        Map.of(
                                "role", "user",
                                "parts", List.of(Map.of("text", userPrompt))
                        )
                ),
                "generationConfig", Map.of(
                        "temperature", 0.3,
                        "responseMimeType", "application/json"
                )
        );

        String endpointUrl = getGeminiGenerateContentUrl();
        HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(requestBody, headers);
        ResponseEntity<String> response = restTemplate.postForEntity(endpointUrl, requestEntity, String.class);

        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new BadRequestException("Google Gemini API returned status " + response.getStatusCode());
        }

        String rawJson = extractGeminiContent(response.getBody());
        List<GeneratedQuestion> questions = parseGeneratedQuestions(rawJson, req);

        return GenerateResponse.builder()
                .isFallback(false)
                .provider("GEMINI")
                .model(properties.getModel())
                .message("Tạo câu hỏi thành công bằng Google Gemini AI (" + properties.getModel() + ").")
                .questions(questions)
                .build();
    }

    private GeneratedQuestion callGeminiRegenerateSingle(RegenerateSingleRequest req) throws Exception {
        RestTemplate restTemplate = buildRestTemplate();
        String systemInstruction = buildSystemPrompt();

        String prompt = "Please REGENERATE and IMPROVE this specific examination question based on the teacher's instructions:\n"
                + "Original Question: " + objectMapper.writeValueAsString(req.getQuestion()) + "\n"
                + "Teacher Instruction: " + (req.getInstruction() != null ? req.getInstruction() : "Make it more rigorous, realistic, and clear.") + "\n"
                + "Topic: " + (req.getTopic() != null ? req.getTopic() : "General") + "\n"
                + "Language: " + (req.getLanguage() != null ? req.getLanguage() : "Vietnamese") + "\n"
                + "Output STRICTLY in the exact single question JSON format matching the schema.";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-goog-api-key", properties.getApiKey().trim());

        Map<String, Object> requestBody = Map.of(
                "systemInstruction", Map.of("parts", List.of(Map.of("text", systemInstruction))),
                "contents", List.of(Map.of("role", "user", "parts", List.of(Map.of("text", prompt)))),
                "generationConfig", Map.of("temperature", 0.4, "responseMimeType", "application/json")
        );

        String endpointUrl = getGeminiGenerateContentUrl();
        HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(requestBody, headers);
        ResponseEntity<String> response = restTemplate.postForEntity(endpointUrl, requestEntity, String.class);

        String rawJson = extractGeminiContent(response.getBody());
        String cleaned = cleanJsonContent(rawJson);
        JsonNode node = objectMapper.readTree(cleaned);

        if (node.has("questions") && node.get("questions").isArray() && !node.get("questions").isEmpty()) {
            return parseSingleQuestionNode(node.get("questions").get(0), req.getQuestion().getType());
        } else {
            return parseSingleQuestionNode(node, req.getQuestion().getType());
        }
    }

    private String buildSystemPrompt() {
        return """
                You are an expert exam question author and pedagogical examiner for the FAMS LMS academic system.
                Your goal is to generate high-quality, academically rigorous, and curriculum-aligned examination questions.

                You MUST strictly follow these rules:
                1. MULTIPLE_CHOICE:
                   - Provide a clear problem statement in `content`.
                   - Provide exactly 4 options in `options` with `content` and `correct` boolean.
                   - Exactly ONE option MUST have `correct: true`.
                   - Provide an `explanation` detailing why the answer is correct and why other options are incorrect.
                   - `difficulty`: "EASY", "MEDIUM", or "HARD".

                2. ESSAY:
                   - Provide an in-depth essay question in `content`.
                   - Provide clear `studentInstructions` on required steps or format.
                   - Provide a thorough, complete `referenceAnswer` (model answer).
                   - Provide a detailed `rubric` description.
                   - Provide `gradingCriteria`: array of objects with `name`, `description`, `weightPercentage`.
                   - The sum of `weightPercentage` across all gradingCriteria MUST BE EXACTLY 100%.

                3. CODING:
                   - Provide a complete markdown problem description in `content` with:
                     * Problem Statement
                     * Input Format
                     * Output Format
                     * Constraints (e.g. 1 <= N <= 10^5)
                     * Sample Input & Output
                     * Explanation
                   - Provide `code` specification:
                     * `functionName`: valid Java method identifier (e.g. `solve`, `twoSum`, `findDuplicate`, `isValid`)
                     * `returnType`: one of "int", "long", "double", "boolean", "char", "String", "int[]", "boolean[]", "String[]"
                     * `params`: list of parameter objects `[{"name": "arr", "type": "int[]"}, {"name": "target", "type": "int"}]`
                     * `tests`: list of at least 3 test cases `[{"inputs": ["..."], "expected": "...", "visible": true}]` with at least 1 hidden test (`visible: false`).
                     * `starterCode`: Java method signature inside `class Solution { ... }`.
                     * `referenceCode`: Complete working solution inside `class Solution { ... }`.
                     * `timeLimitSeconds`: 5

                OUTPUT SCHEMA (Valid JSON only):
                {
                  "questions": [
                    {
                      "tempId": "q_1",
                      "type": "MULTIPLE_CHOICE" | "ESSAY" | "CODING",
                      "difficulty": "EASY" | "MEDIUM" | "HARD",
                      "points": <integer>,
                      "topic": "<string>",
                      "content": "<string>",
                      "explanation": "<string>",
                      "options": [
                        { "content": "<string>", "correct": <boolean> }
                      ],
                      "studentInstructions": "<string>",
                      "referenceAnswer": "<string>",
                      "rubric": "<string>",
                      "gradingCriteria": [
                        { "name": "<string>", "description": "<string>", "weightPercentage": <integer> }
                      ],
                      "code": {
                        "functionName": "<string>",
                        "returnType": "<string>",
                        "params": [ {"name": "<string>", "type": "<string>"} ],
                        "tests": [ {"inputs": ["<string>"], "expected": "<string>", "visible": <boolean>} ],
                        "starterCode": "<string>",
                        "referenceCode": "<string>",
                        "timeLimitSeconds": 5
                      }
                    }
                  ]
                }
                """;
    }

    private String buildUserPrompt(GenerateRequest req) {
        StringBuilder sb = new StringBuilder();
        sb.append("Please create examination questions based on the following input and specifications:\n\n");

        if (req.getCourseName() != null && !req.getCourseName().isBlank()) {
            sb.append("Course: ").append(req.getCourseName()).append("\n");
        }
        if (req.getExamTitle() != null && !req.getExamTitle().isBlank()) {
            sb.append("Exam Title: ").append(req.getExamTitle()).append("\n");
        }
        if (req.getTopic() != null && !req.getTopic().isBlank()) {
            sb.append("Topic: ").append(req.getTopic()).append("\n");
        }
        String lang = req.getLanguage() != null && !req.getLanguage().isBlank() ? req.getLanguage() : "Vietnamese";
        sb.append("Language: ").append(lang).append("\n\n");

        sb.append("REQUESTED QUESTION BREAKDOWN:\n");
        for (QuestionTypeRequestItem item : req.getRequests()) {
            sb.append("- Type: ").append(item.getType())
                    .append(", Count: ").append(item.getCount())
                    .append(", Difficulty: ").append(item.getDifficulty())
                    .append(", Points: ").append(item.getPoints())
                    .append("\n");
        }

        if (req.getAdditionalInstructions() != null && !req.getAdditionalInstructions().isBlank()) {
            sb.append("\nAdditional Teacher Requirements:\n").append(req.getAdditionalInstructions()).append("\n");
        }

        if ("PROMPT".equalsIgnoreCase(req.getMode()) && req.getPrompt() != null && !req.getPrompt().isBlank()) {
            sb.append("\nTEACHER PROMPT / DESCRIPTION:\n").append(req.getPrompt()).append("\n");
        }

        if (req.getDocumentContent() != null && !req.getDocumentContent().isBlank()) {
            sb.append("\nCURRICULUM / LECTURE CONTENT MATERIAL:\n").append(req.getDocumentContent()).append("\n");
        }

        return sb.toString();
    }

    private String extractGeminiContent(String responseBody) throws Exception {
        JsonNode root = objectMapper.readTree(responseBody);
        JsonNode candidates = root.path("candidates");
        if (!candidates.isArray() || candidates.isEmpty()) {
            throw new BadRequestException("Gemini response missing candidates");
        }
        JsonNode parts = candidates.get(0).path("content").path("parts");
        if (!parts.isArray() || parts.isEmpty()) {
            throw new BadRequestException("Gemini response missing parts");
        }
        return parts.get(0).path("text").asText("");
    }

    private String cleanJsonContent(String content) {
        String cleaned = content.trim();
        if (cleaned.startsWith("```json")) {
            cleaned = cleaned.substring(7);
        } else if (cleaned.startsWith("```")) {
            cleaned = cleaned.substring(3);
        }
        if (cleaned.endsWith("```")) {
            cleaned = cleaned.substring(0, cleaned.length() - 3);
        }
        return cleaned.trim();
    }

    private List<GeneratedQuestion> parseGeneratedQuestions(String rawJson, GenerateRequest req) {
        List<GeneratedQuestion> result = new ArrayList<>();
        try {
            String cleaned = cleanJsonContent(rawJson);
            JsonNode root = objectMapper.readTree(cleaned);
            JsonNode questionsNode = root.path("questions");

            if (questionsNode.isArray()) {
                for (JsonNode qNode : questionsNode) {
                    QuestionType type = QuestionType.valueOf(qNode.path("type").asText("MULTIPLE_CHOICE").toUpperCase());
                    GeneratedQuestion gq = parseSingleQuestionNode(qNode, type);
                    result.add(gq);
                }
            }
        } catch (Exception e) {
            log.error("Failed to parse Gemini generated questions JSON: {}", rawJson, e);
            throw new BadRequestException("Không thể phân tích dữ liệu câu hỏi từ AI. Vui lòng thử lại.");
        }

        if (result.isEmpty()) {
            throw new BadRequestException("AI không tạo được câu hỏi nào phù hợp với yêu cầu.");
        }
        return result;
    }

    private GeneratedQuestion parseSingleQuestionNode(JsonNode qNode, QuestionType type) {
        String tempId = qNode.path("tempId").asText("gen_" + UUID.randomUUID().toString().substring(0, 8));
        String content = qNode.path("content").asText("Câu hỏi");
        int points = Math.max(1, qNode.path("points").asInt(1));
        Difficulty difficulty = Difficulty.valueOf(qNode.path("difficulty").asText("MEDIUM").toUpperCase());
        String topic = qNode.path("topic").asText("Chung");
        String explanation = qNode.path("explanation").asText("");

        GeneratedQuestion.GeneratedQuestionBuilder builder = GeneratedQuestion.builder()
                .tempId(tempId)
                .type(type)
                .content(content)
                .points(points)
                .difficulty(difficulty)
                .topic(topic)
                .explanation(explanation);

        if (type == QuestionType.MULTIPLE_CHOICE) {
            List<OptionItem> options = new ArrayList<>();
            JsonNode optsNode = qNode.path("options");
            if (optsNode.isArray()) {
                for (JsonNode o : optsNode) {
                    options.add(new OptionItem(o.path("content").asText(""), o.path("correct").asBoolean(false)));
                }
            }
            if (options.stream().noneMatch(OptionItem::isCorrect) && !options.isEmpty()) {
                options.get(0).setCorrect(true);
            }
            builder.options(options);
        } else if (type == QuestionType.ESSAY) {
            builder.studentInstructions(qNode.path("studentInstructions").asText(""));
            builder.referenceAnswer(qNode.path("referenceAnswer").asText(""));
            builder.rubric(qNode.path("rubric").asText(""));

            List<GradingCriterionItem> criteria = new ArrayList<>();
            JsonNode critNode = qNode.path("gradingCriteria");
            if (critNode.isArray()) {
                for (JsonNode c : critNode) {
                    criteria.add(new GradingCriterionItem(
                            c.path("name").asText("Tiêu chí"),
                            c.path("description").asText(""),
                            c.path("weightPercentage").asInt(25)
                    ));
                }
            }
            builder.gradingCriteria(criteria);
        } else if (type == QuestionType.CODING) {
            JsonNode codeNode = qNode.path("code");
            if (!codeNode.isMissingNode() && codeNode.isObject()) {
                CodeSpecDTO codeSpec = new CodeSpecDTO();
                codeSpec.setFunctionName(codeNode.path("functionName").asText("solve"));
                codeSpec.setReturnType(codeNode.path("returnType").asText("int"));
                codeSpec.setTimeLimitSeconds(codeNode.path("timeLimitSeconds").asInt(5));
                codeSpec.setStarterCode(codeNode.path("starterCode").asText(""));
                codeSpec.setReferenceCode(codeNode.path("referenceCode").asText(""));

                List<CodeSpecDTO.Param> params = new ArrayList<>();
                JsonNode paramsNode = codeNode.path("params");
                if (paramsNode.isArray()) {
                    for (JsonNode p : paramsNode) {
                        CodeSpecDTO.Param param = new CodeSpecDTO.Param();
                        param.setName(p.path("name").asText("input"));
                        param.setType(p.path("type").asText("int"));
                        params.add(param);
                    }
                }
                codeSpec.setParams(params);

                List<CodeSpecDTO.TestCase> tests = new ArrayList<>();
                JsonNode testsNode = codeNode.path("tests");
                if (testsNode.isArray()) {
                    for (JsonNode t : testsNode) {
                        CodeSpecDTO.TestCase tc = new CodeSpecDTO.TestCase();
                        List<String> inputs = new ArrayList<>();
                        if (t.path("inputs").isArray()) {
                            for (JsonNode in : t.path("inputs")) {
                                inputs.add(in.asText(""));
                            }
                        }
                        tc.setInputs(inputs);
                        tc.setExpected(t.path("expected").asText(""));
                        tc.setVisible(t.path("visible").asBoolean(true));
                        tests.add(tc);
                    }
                }
                codeSpec.setTests(tests);
                builder.code(codeSpec);
            }
        }

        return builder.build();
    }

    // -------------------------------------------------------------------------
    // LOCAL ACADEMIC FALLBACK GENERATOR (When Gemini API Key is not configured)
    // -------------------------------------------------------------------------
    private GenerateResponse generateLocalFallback(GenerateRequest req) {
        List<GeneratedQuestion> questions = new ArrayList<>();
        String topic = req.getTopic() != null && !req.getTopic().isBlank()
                ? req.getTopic()
                : (req.getCourseName() != null ? req.getCourseName() : "Kiến thức Lập trình & Thuật toán");

        int qIndex = 1;
        for (QuestionTypeRequestItem item : req.getRequests()) {
            for (int i = 0; i < item.getCount(); i++) {
                questions.add(createSampleQuestion(item.getType(), item.getDifficulty(), item.getPoints(), topic, qIndex++));
            }
        }

        return GenerateResponse.builder()
                .isFallback(true)
                .provider("FALLBACK")
                .model("Rule-based Academic Fallback")
                .message("Chế độ Fallback: Hệ thống đang tạo câu hỏi mẫu theo chủ đề do chưa cấu hình GEMINI_API_KEY trên server.")
                .questions(questions)
                .build();
    }

    private GeneratedQuestion generateSingleFallback(GeneratedQuestion original, String instruction, String topic, String language) {
        String resolvedTopic = topic != null && !topic.isBlank() ? topic : original.getTopic();
        GeneratedQuestion refreshed = createSampleQuestion(original.getType(), original.getDifficulty(), original.getPoints(), resolvedTopic, new Random().nextInt(100) + 10);
        refreshed.setTempId(original.getTempId());
        if (instruction != null && !instruction.isBlank()) {
            refreshed.setContent(refreshed.getContent() + " (Đã điều chỉnh theo yêu cầu: " + instruction + ")");
        }
        return refreshed;
    }

    private GeneratedQuestion createSampleQuestion(QuestionType type, Difficulty difficulty, int points, String topic, int index) {
        String id = "gen_" + UUID.randomUUID().toString().substring(0, 8);

        if (type == QuestionType.MULTIPLE_CHOICE) {
            return GeneratedQuestion.builder()
                    .tempId(id)
                    .type(QuestionType.MULTIPLE_CHOICE)
                    .difficulty(difficulty)
                    .points(points)
                    .topic(topic)
                    .content("Trong ngữ cảnh " + topic + ", phát biểu nào sau đây là CHÍNH XÁC nhất về nguyên lý hoạt động?")
                    .explanation("Đáp án A là chính xác vì thể hiện đầy đủ định nghĩa và nguyên tắc thiết kế trong " + topic + ".")
                    .options(List.of(
                            new OptionItem("Đảm bảo tính đóng gói (Encapsulation) và giảm thiểu sự phụ thuộc trực tiếp giữa các module.", true),
                            new OptionItem("Cho phép truy cập tự do vào toàn bộ thuộc tính private từ mọi lớp bên ngoài.", false),
                            new OptionItem("Tự động cấp phát bộ nhớ vô hạn mà không cần giải phóng hoặc thu gom rác.", false),
                            new OptionItem("Bắt buộc tất cả các phương thức đều phải là static.", false)
                    ))
                    .build();
        } else if (type == QuestionType.ESSAY) {
            return GeneratedQuestion.builder()
                    .tempId(id)
                    .type(QuestionType.ESSAY)
                    .difficulty(difficulty)
                    .points(points > 1 ? points : 10)
                    .topic(topic)
                    .content("Hãy phân tích ưu điểm và nhược điểm của việc áp dụng " + topic + " trong việc phát triển hệ thống phần mềm thực tế. Đưa ra một ví dụ minh họa cụ thể.")
                    .studentInstructions("Bài làm cần trình bày rõ ràng 3 phần: (1) Khái niệm và nguyên lý, (2) So sánh ưu/nhược điểm, (3) Ví dụ code hoặc kiến trúc minh họa.")
                    .referenceAnswer("Đáp án tham khảo: 1. Nêu đúng định nghĩa và bản chất của " + topic + ". 2. Phân tích ưu điểm: Tăng tính tái sử dụng, dễ bảo trì, mở rộng tốt. Nhược điểm: Tăng độ phức tạp ban đầu, chi phí tài nguyên. 3. Ví dụ minh họa thực tế rõ ràng, logic.")
                    .rubric("Tiêu chí đánh giá gồm: Độ chính xác lý thuyết (30%), Khả năng phân tích ưu/nhược điểm (40%), Tính thực tiễn của ví dụ minh họa (30%).")
                    .gradingCriteria(List.of(
                            new GradingCriterionItem("Hiểu đúng lý thuyết & bản chất", "Trình bày chính xác định nghĩa và nguyên lý", 30),
                            new GradingCriterionItem("Phân tích so sánh ưu / nhược điểm", "So sánh logic, có dẫn chứng cụ thể", 40),
                            new GradingCriterionItem("Ví dụ minh họa thực tiễn", "Code hoặc kiến trúc áp dụng thực tế hợp lý", 30)
                    ))
                    .build();
        } else {
            // CODING
            CodeSpecDTO codeSpec = new CodeSpecDTO();
            codeSpec.setFunctionName("findMaximumSubarraySum");
            codeSpec.setReturnType("int");
            codeSpec.setTimeLimitSeconds(5);
            CodeSpecDTO.Param p = new CodeSpecDTO.Param();
            p.setName("nums");
            p.setType("int[]");
            codeSpec.setParams(List.of(p));

            CodeSpecDTO.TestCase tc1 = new CodeSpecDTO.TestCase();
            tc1.setInputs(List.of("[-2,1,-3,4,-1,2,1,-5,4]"));
            tc1.setExpected("6");
            tc1.setVisible(true);

            CodeSpecDTO.TestCase tc2 = new CodeSpecDTO.TestCase();
            tc2.setInputs(List.of("[1]"));
            tc2.setExpected("1");
            tc2.setVisible(true);

            CodeSpecDTO.TestCase tc3 = new CodeSpecDTO.TestCase();
            tc3.setInputs(List.of("[5,4,-1,7,8]"));
            tc3.setExpected("23");
            tc3.setVisible(false);

            codeSpec.setTests(List.of(tc1, tc2, tc3));
            codeSpec.setStarterCode("""
                    class Solution {
                        public int findMaximumSubarraySum(int[] nums) {
                            // Viết giải thuật của bạn ở đây
                            return 0;
                        }
                    }
                    """);
            codeSpec.setReferenceCode("""
                    class Solution {
                        public int findMaximumSubarraySum(int[] nums) {
                            int maxSum = nums[0];
                            int currentSum = nums[0];
                            for (int i = 1; i < nums.length; i++) {
                                currentSum = Math.max(nums[i], currentSum + nums[i]);
                                maxSum = Math.max(maxSum, currentSum);
                            }
                            return maxSum;
                        }
                    }
                    """);

            return GeneratedQuestion.builder()
                    .tempId(id)
                    .type(QuestionType.CODING)
                    .difficulty(difficulty)
                    .points(points > 1 ? points : 10)
                    .topic(topic)
                    .content("""
                            ### Bài toán: Tìm tổng dãy con liên tiếp lớn nhất (Maximum Subarray)

                            **Mô tả:**
                            Cho một mảng số nguyên `nums`. Hãy tìm dãy con liên tiếp (chứa ít nhất một phần tử) có tổng giá trị lớn nhất và trả về giá trị tổng đó.

                            **Đầu vào:**
                            - Mảng `nums` chứa các số nguyên (`1 <= nums.length <= 10^5`, `-10^4 <= nums[i] <= 10^4`).

                            **Đầu ra:**
                            - Một số nguyên duy nhất là tổng lớn nhất của dãy con liên tiếp.

                            **Ví dụ 1:**
                            - Input: `nums = [-2,1,-3,4,-1,2,1,-5,4]`
                            - Output: `6`
                            - Giải thích: Dãy con `[4,-1,2,1]` có tổng lớn nhất là 6.

                            **Ràng buộc:**
                            - Thời gian chạy tối đa: 5 giây.
                            - Bộ nhớ tối đa: 256MB.
                            """)
                    .code(codeSpec)
                    .build();
        }
    }

    private String getGeminiGenerateContentUrl() {
        String base = properties.getEndpoint() != null
                ? properties.getEndpoint().trim().replaceAll("/+$", "")
                : "https://generativelanguage.googleapis.com/v1beta/models";
        return base + "/" + properties.getModel() + ":generateContent";
    }

    private RestTemplate buildRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        int timeoutMs = Math.max(5, properties.getTimeoutSeconds()) * 1000;
        factory.setConnectTimeout(timeoutMs);
        factory.setReadTimeout(timeoutMs);
        return new RestTemplate(factory);
    }
}
