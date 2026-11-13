
package com.example.starter_project_2025.system.project.aiassistant.transaction;

import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.*;
import com.example.starter_project_2025.system.project.aiassistant.entity.AiSuggestion;
import com.example.starter_project_2025.system.project.aiassistant.enums.SuggestionStatus;
import com.example.starter_project_2025.system.project.aiassistant.repository.AiSuggestionRepository;
import com.example.starter_project_2025.system.project.aiassistant.service.apply.AIApplyService;
import com.example.starter_project_2025.system.project.aiassistant.validator.TemplateOutputValidator;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class AIApplyRollbackIntegrationTest {

    @Autowired
    private AIApplyService aiApplyService;

    @Autowired
    private EntityManager em;

    @Autowired
    private TransactionTemplate tx;

    @Autowired
    private UserDetailsService details;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roles;

    @Autowired
    private TemplateOutputValidator templateOutputValidator;

    @Autowired
    private AiSuggestionRepository aiSuggestionRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void contextLoads() {
        assert aiApplyService != null;
    }

    private void authenticateAs(User user) {
        var principal = details.loadUserByUsername(user.getEmail());

        var authentication =
                new UsernamePasswordAuthenticationToken(
                        principal,
                        null,
                        principal.getAuthorities()
                );

        SecurityContextHolder.getContext()
                .setAuthentication(authentication);
    }

    private User user(Tenant tenant, String role, String label) {
        var user = new User();

        user.setEmail(UUID.randomUUID() + "@ai-test.local");
        user.setPasswordHash("unused");
        user.setFirstName(label);
        user.setLastName("Test");
        user.setUserCode("AI-" + UUID.randomUUID());
        user.setTenant(tenant);

        user.setRoles(new HashSet<>(Set.of(
                roles.findByName(role).orElseThrow()
        )));

        em.persist(user);
        em.flush();

        return user;
    }

    @BeforeEach
    void setup() {
        tx.executeWithoutResult(status -> {
            var tenant = Tenant.builder()
                    .code("AI-TEST-" + UUID.randomUUID())
                    .name("AI Integration Test")
                    .build();

            em.persist(tenant);
            em.flush();

            // Seed catalog options cho tenant test
            jdbcTemplate.update("""
                INSERT INTO project_template_catalog
                    (option_kind, tenant_scope_id, option_value, label, sort_order)
                VALUES
                    ('DOMAIN', ?, 'Software Engineering', 'Software Engineering', 1),
                    ('LEVEL', ?, 'INTERMEDIATE', 'Intermediate', 1)
                """,
                    tenant.getId(),
                    tenant.getId()
            );

            var mentor = user(tenant, "MENTOR", "Mentor");

            authenticateAs(mentor);
        });
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldAuthenticateAsMentor() {
        var authentication =
                SecurityContextHolder.getContext().getAuthentication();

        assertNotNull(authentication);
        assertTrue(authentication.isAuthenticated());

        assertTrue(authentication.getAuthorities().stream()
                .anyMatch(authority ->
                        authority.getAuthority().equals("ROLE_MENTOR")));
    }

    private GeneratedTemplateOutput createValidOutput() {

        var projectTemplate = new ProjectTemplateOutput(
                "AI-ROLLBACK-TEST",
                "AI Rollback Test",
                "Template used for rollback integration testing",
                "Java 21, Spring Boot",
                "Software Engineering",
                "INTERMEDIATE",
                8
        );

        var teamConstraints = new TeamConstraintsOutput(
                4,
                6,
                new TeamConstraintsOutput.RoleQuotasOutput(
                        1, 1, 3, 1
                ),
                false
        );

        var ratings = List.of(
                new RubricRatingOutput("EXCELLENT", "Excellent performance"),
                new RubricRatingOutput("GOOD", "Good performance"),
                new RubricRatingOutput("FAIR", "Fair performance"),
                new RubricRatingOutput("NOT_MET", "Requirements not met")
        );

        var rubricCriteria = List.of(
                new RubricCriterionOutput(
                        "CODE_QUALITY",
                        "Code Quality",
                        "Evaluate code quality",
                        new BigDecimal("50.00"),
                        new BigDecimal("50.00"),
                        0,
                        ratings
                ),
                new RubricCriterionOutput(
                        "FUNCTIONALITY",
                        "Functionality",
                        "Evaluate implementation completeness",
                        new BigDecimal("50.00"),
                        new BigDecimal("50.00"),
                        1,
                        ratings
                )
        );

        var checklistItems = List.of(
                new ChecklistItemOutput(
                        "Complete implementation",
                        true,
                        1
                )
        );

        var milestones = List.of(
                new MilestoneOutput(
                        "Final Milestone",
                        "Complete the project",
                        8,
                        "WEEKS",
                        new BigDecimal("100.00"),
                        true,
                        1,
                        false,
                        null,
                        null,
                        checklistItems,
                        rubricCriteria
                )
        );

        var backlogItems = List.of(
                new BacklogItemOutput(
                        "Implement backend",
                        "Develop backend APIs",
                        "DEV",
                        1
                )
        );

        var modules = List.of(
                new ModuleOutput(
                        "AI-MODULE-01",
                        "Backend Module",
                        "Backend development module",
                        "Java 21, Spring Boot",
                        "Software Engineering",
                        "INTERMEDIATE",
                        4
                )
        );

        var resources = List.of(
                new ResourceOutput(
                        "Spring Boot Documentation",
                        "Official Spring Boot documentation",
                        "LINK",
                        "https://docs.spring.io/spring-boot/index.html",
                        1
                )
        );

        return new GeneratedTemplateOutput(
                projectTemplate,
                teamConstraints,
                milestones,
                backlogItems,
                modules,
                resources
        );
    }

    @Test
    void shouldCreateValidGeneratedTemplateOutput() {
        GeneratedTemplateOutput output = createValidOutput();

        assertDoesNotThrow(() ->
                templateOutputValidator.validate(output)
        );
    }

    private AiSuggestion createApprovedSuggestion() throws JsonProcessingException {

        GeneratedTemplateOutput output = createValidOutput();

        AiSuggestion suggestion = AiSuggestion.builder()
                .projectTitle("AI Rollback Test")
                .projectDescription("Suggestion for rollback integration test")
                .projectType("SOFTWARE")
                .additionalRequirements("Test rollback behavior")
                .generatedContent(objectMapper.writeValueAsString(output))
                .aiModel("test-model")
                .status(SuggestionStatus.APPROVED)
                .build();

        return aiSuggestionRepository.saveAndFlush(suggestion);
    }
}
