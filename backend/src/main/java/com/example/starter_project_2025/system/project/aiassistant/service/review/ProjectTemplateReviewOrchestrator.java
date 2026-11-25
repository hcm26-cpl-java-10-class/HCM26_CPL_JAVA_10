package com.example.starter_project_2025.system.project.aiassistant.service.review;

import com.example.starter_project_2025.system.project.aiassistant.dto.ReviewContext;
import com.example.starter_project_2025.system.project.aiassistant.dto.ReviewNodeContext;
import com.example.starter_project_2025.system.project.aiassistant.dto.ReviewNodeContextMapper;
import com.example.starter_project_2025.system.project.aiassistant.dto.ReviewTemplateNode;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review.AIReviewFindingOutput;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review.AIReviewOutput;
import com.example.starter_project_2025.system.project.aiassistant.enums.ReviewNodeType;
import com.example.starter_project_2025.system.project.aiassistant.prompt.ReviewPromptBuilder;
import com.example.starter_project_2025.system.project.aiassistant.provider.LlmProvider;
import com.example.starter_project_2025.system.project.aiassistant.provider.LlmRequest;
import com.example.starter_project_2025.system.project.aiassistant.provider.LlmResponse;
import com.example.starter_project_2025.system.project.aiassistant.validator.ReviewValidator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ProjectTemplateReviewOrchestrator {

    private final ReviewNodeContextMapper nodeContextMapper;
    private final ReviewPromptBuilder promptBuilder;
    private final LlmProvider llmProvider;
    private final ReviewOutputParser outputParser;
    private final ReviewValidator reviewValidator;

    private AIReviewOutput reviewNode(
            ReviewNodeContext context,
            ReviewNodeType nodeType
    ) {
        LlmRequest request = promptBuilder.build(context, nodeType);

        LlmResponse response = llmProvider.generate(request);

        AIReviewOutput output = outputParser.parse(response.content());

        reviewValidator.validate(output, context, nodeType);

        return output;
    }

    //ReviewNodeContextMapper ->	Chuyển Root/Module thành context chuẩn hóa
    //ReviewPromptBuilder ->	Tạo prompt cho AI
    //LlmProvider	-> Gọi AI
    //ReviewOutputParser	-> Chuyển JSON thành DTO
    //ReviewValidator	-> Kiểm tra kết quả AI

    public AIReviewOutput reviewRoot(ReviewContext context) {
        ReviewNodeContext nodeContext = nodeContextMapper.fromRoot(context);

        return reviewNode(nodeContext, ReviewNodeType.ROOT);
    }

    private AIReviewOutput reviewModule(ReviewTemplateNode module) {
        ReviewNodeContext nodeContext = nodeContextMapper.fromModule(module);

        return reviewNode(nodeContext, ReviewNodeType.MODULE);
    }

    private void reviewModules(
            List<ReviewTemplateNode> modules,
            List<AIReviewFindingOutput> findings,
            List<String> summaries
    ) {
        if (modules == null || modules.isEmpty()) {
            return;
        }

        for (ReviewTemplateNode module : modules) {
            AIReviewOutput output = reviewModule(module);

            findings.addAll(output.findings());

            summaries.add(
                    "Module " + module.code() + " - " + module.name()
                            + ": " + output.summary()
            );

            reviewModules(module.modules(), findings, summaries);
        }
    }

    public AIReviewOutput review(ReviewContext context) {

        AIReviewOutput rootOutput = reviewRoot(context);

        List<AIReviewFindingOutput> findings =
                new ArrayList<>(rootOutput.findings());

        List<String> summaries = new ArrayList<>();
        summaries.add("ROOT TEMPLATE: " + rootOutput.summary());

        reviewModules(context.modules(), findings, summaries);

        String combinedSummary = String.join("\n\n", summaries);

        return new AIReviewOutput(combinedSummary, findings);
    }

}