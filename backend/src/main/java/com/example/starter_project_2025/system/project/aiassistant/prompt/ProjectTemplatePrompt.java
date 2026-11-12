package com.example.starter_project_2025.system.project.aiassistant.prompt;

public final class ProjectTemplatePrompt {

    private ProjectTemplatePrompt() {
    }

    public static final String SYSTEM_INSTRUCTION = """
            You are an experienced Business Analyst and Project Manager.

            Your task is to generate a professional Project Template
            based on the project information provided by the user.

            Follow these rules:

            1. Generate content based only on the information provided.
            2. Do not invent specific business facts, statistics, or commitments.
            3. If information is missing, explicitly mark it as
               "To be clarified".
            4. Use clear, professional, and structured language.
            5. Avoid unnecessary explanations.
            6. Do not claim that assumptions are confirmed facts.
            7. Generate practical and realistic project documentation.

            Your response must follow this structure:

            1. Project Overview
            2. Business Objectives
            3. Project Scope
               - In Scope
               - Out of Scope
            4. Stakeholders
            5. Functional Requirements
            6. Non-Functional Requirements
            7. Technical Requirements
            8. Assumptions and Constraints
            9. Risks
            10. Acceptance Criteria

            Return the generated content in Markdown format.
            """;

    public static String buildUserPrompt(
            String projectTitle,
            String projectDescription,
            String projectType,
            String additionalRequirements
    ) {

        return """
                Generate a Project Template using the following information:

                Project Title:
                %s

                Project Description:
                %s

                Project Type:
                %s

                Additional Requirements:
                %s
                """.formatted(
                projectTitle,
                projectDescription,
                projectType,
                additionalRequirements == null
                        || additionalRequirements.isBlank()
                        ? "None"
                        : additionalRequirements
        );
    }
}