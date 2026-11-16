package com.example.starter_project_2025.system.project.template.assignment.hierarchy;

import com.example.starter_project_2025.init.SprintBacklogDataInitializer;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.project.*;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateVersionStatus;
import com.example.starter_project_2025.system.project.rubric.domain.Rubric;
import com.example.starter_project_2025.system.project.rubric.domain.RubricRatingLevel;
import com.example.starter_project_2025.system.project.rubric.domain.RubricVersion;
import com.example.starter_project_2025.system.project.rubric.integration.RubricTenantIdentity;
import com.example.starter_project_2025.system.project.template.ProjectTemplateStatus;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.trainingclass.*;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {"app.seed.board.enabled=false", "app.seed.team-allocation.enabled=false",
        "app.task-alert.demo.enabled=false", "app.member-reminder.demo.enabled=false",
        "app.project-reports.export.worker-enabled=false", "milestone.mock.seed-enabled=false",
        "milestone.submission.mock.seed-enabled=false"})
@ActiveProfiles({"test", "artifact-real-scope"})
@AutoConfigureMockMvc
class AssignmentCatalogIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired EntityManager em;
    @Autowired TransactionTemplate tx;
    @Autowired RoleRepository roles;
    @Autowired UserDetailsService details;
    @Autowired RefreshTokenService tokens;
    @MockBean SprintBacklogDataInitializer legacySeed;

    Long classId, sessionId, teamId, shopId, shopVersionId, cartId, analyticsId;
    String admin, student;

    @BeforeEach
    void setup() {
        tx.executeWithoutResult(status -> {
            var tenant = Tenant.builder().code("CAT-" + UUID.randomUUID()).name("Catalogue").build();
            em.persist(tenant);
            em.flush();
            admin = token(user(tenant, "ADMIN", "Admin"));
            var mentor = user(tenant, "TEACHER", "Mentor");
            var learner = user(tenant, "STUDENT", "Learner");
            student = token(learner);

            var school = new TrainingClass();
            school.setTenantId(tenant.getId());
            school.setProgramId(1L);
            school.setProgramName("Java");
            school.setCode("CAT-" + UUID.randomUUID());
            school.setName("Catalogue class");
            school.setStatus(TrainingClassStatus.ONGOING);
            school.setMentorId(mentor.getId());
            em.persist(school);
            em.flush();
            classId = school.getId();

            UUID rubricVersionId = publishedRubric(tenant.getId());

            // Master with one module: the template row is renamed after publishing, the catalogue must show the
            // published snapshot instead. A newer DRAFT version must not leak either.
            var shop = template(tenant.getId(), null, "SHOP", "Renamed in draft", ProjectTemplateStatus.ACTIVE);
            shopId = shop.getId();
            var cart = template(tenant.getId(), shop, "CART", "Cart", ProjectTemplateStatus.ACTIVE);
            cartId = cart.getId();
            var cartVersion = snapshot(cartId, "v1", ProjectTemplateVersionStatus.PUBLISHED, """
                    {"templateId":%d,"code":"CART","name":"Cart","description":"Basket and checkout",
                     "constraints":{"min_members":1,"max_members":3},
                     "milestones":[{"title":"Cart API","dueAfter":3,"dueUnit":"DAYS","mandatory":true}],"modules":[]}
                    """.formatted(cartId));
            shopVersionId = snapshot(shopId, "v2", ProjectTemplateVersionStatus.PUBLISHED, """
                    {"templateId":%d,"code":"SHOP","name":"E-commerce Platform","description":"Build an online shop.",
                     "technologyStack":"Spring Boot, React","category":"Web","level":"INTERMEDIATE",
                     "estimatedDurationWeeks":8,"constraints":{"min_members":1,"max_members":5},
                     "milestones":[{"title":"Design","description":"ERD and wireframes","dueAfter":1,"dueUnit":"WEEKS",
                       "weight":30,"mandatory":true,"checklistItems":[{"content":"ERD approved","mandatory":true}],
                       "rubricVersionId":"%s"},
                      {"title":"Demo","dueAfter":6,"dueUnit":"WEEKS","weight":70,"mandatory":true,
                       "rubricVersionId":"%s",
                       "rubricCriteria":[{"name":"Live demo","description":"Works end to end","maxScore":8},
                                         {"name":"Q&A","maxScore":2}]}],
                     "backlogItems":[{"title":"Login","description":"JWT login","suggestedRole":"DEV"}],
                     "modules":[{"templateId":%d,"versionId":%d,"code":"CART","name":"Cart",
                       "description":"Basket and checkout","constraints":{"min_members":1,"max_members":3},
                       "milestones":[{"title":"Cart API","dueAfter":3,"dueUnit":"DAYS","mandatory":true}],"modules":[]}]}
                    """.formatted(shopId, rubricVersionId, UUID.randomUUID(), cartId, cartVersion.getId())).getId();
            snapshot(shopId, "v3", ProjectTemplateVersionStatus.DRAFT, """
                    {"templateId":%d,"code":"SHOP","name":"Draft name","constraints":{"min_members":1,"max_members":5}}
                    """.formatted(shopId));

            var analytics = template(tenant.getId(), null, "DATA", "Analytics", ProjectTemplateStatus.ACTIVE);
            analyticsId = analytics.getId();
            snapshot(analyticsId, "v1", ProjectTemplateVersionStatus.PUBLISHED, """
                    {"templateId":%d,"code":"DATA","name":"Analytics Dashboard","technologyStack":"Python",
                     "category":"Data","level":"ADVANCED","constraints":{"min_members":3,"max_members":6},
                     "milestones":[],"modules":[]}
                    """.formatted(analyticsId));

            // Neither of these may appear: no published version, and a template of another tenant.
            var unpublished = template(tenant.getId(), null, "WIP", "Work in progress", ProjectTemplateStatus.ACTIVE);
            snapshot(unpublished.getId(), "v1", ProjectTemplateVersionStatus.DRAFT, """
                    {"code":"WIP","name":"Work in progress","constraints":{"min_members":1,"max_members":5}}""");
            var otherTenant = Tenant.builder().code("CAT-" + UUID.randomUUID()).name("Other").build();
            em.persist(otherTenant);
            em.flush();
            var foreign = template(otherTenant.getId(), null, "SHOP", "Foreign shop", ProjectTemplateStatus.ACTIVE);
            snapshot(foreign.getId(), "v1", ProjectTemplateVersionStatus.PUBLISHED, """
                    {"code":"SHOP","name":"Foreign shop","constraints":{"min_members":1,"max_members":5}}""");

            var session = new TeamAllocationSession();
            session.setTrainingClass(school);
            session.setStatus(TeamAllocationSessionStatus.OPEN);
            session.setMaxMembers(5);
            em.persist(session);
            em.flush();
            sessionId = session.getId();

            // One-member draft team already bound to the shop master: it is the shop's class owner.
            var team = new ProjectTeam();
            team.setTrainingClass(school);
            team.setAllocationSession(session);
            team.setTeamName("Team Alpha");
            team.setStatus(ProjectTeamStatus.DRAFT);
            team.setMaxMembers(5);
            team.setProjectTemplate(shop);
            em.persist(team);
            em.flush();
            teamId = team.getId();
            var classMember = new ClassMember();
            classMember.setTrainingClass(school);
            classMember.setUser(learner);
            classMember.setStatus(ClassMemberStatus.ACTIVE);
            em.persist(classMember);
            em.flush();
            var member = new ProjectMember();
            member.setTeam(team);
            member.setClassMember(classMember);
            member.setRole("PM");
            em.persist(member);
            em.flush();
        });
    }

    @Test
    void catalogueListsPublishedMastersOfTheTenantFromTheirPublishedSnapshot() throws Exception {
        mvc.perform(authorized(get(templates()), admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(AssignmentCatalogService.DEFAULT_PAGE_SIZE))
                .andExpect(jsonPath("$.categories", contains("Data", "Web")))
                .andExpect(jsonPath("$.items[*].code", contains("DATA", "SHOP")))
                .andExpect(jsonPath("$.items[1].id").value(shopId))
                .andExpect(jsonPath("$.items[1].versionId").value(shopVersionId))
                .andExpect(jsonPath("$.items[1].version").value("v2"))
                .andExpect(jsonPath("$.items[1].name").value("E-commerce Platform"))
                .andExpect(jsonPath("$.items[1].category").value("Web"))
                .andExpect(jsonPath("$.items[1].level").value("INTERMEDIATE"))
                .andExpect(jsonPath("$.items[1].estimatedDurationWeeks").value(8))
                .andExpect(jsonPath("$.items[1].technologyStack").value("Spring Boot, React"))
                .andExpect(jsonPath("$.items[1].moduleCount").value(1))
                .andExpect(jsonPath("$.items[1].milestoneCount").value(3))
                .andExpect(jsonPath("$.items[1].minMembers").value(1))
                .andExpect(jsonPath("$.items[1].maxMembers").value(5))
                .andExpect(jsonPath("$.items[1].assignedTeams", contains("Team Alpha")))
                .andExpect(jsonPath("$.items[0].assignedTeams", hasSize(0)));
    }

    @Test
    void catalogueSearchesFiltersSortsAndPages() throws Exception {
        mvc.perform(authorized(get(templates()).param("search", "  react "), admin))
                .andExpect(jsonPath("$.total").value(1)).andExpect(jsonPath("$.items[0].id").value(shopId));
        mvc.perform(authorized(get(templates()).param("category", "web"), admin))
                .andExpect(jsonPath("$.items[*].id", contains(shopId.intValue())));
        mvc.perform(authorized(get(templates()).param("level", "advanced"), admin))
                .andExpect(jsonPath("$.items[*].id", contains(analyticsId.intValue())));
        // The only team has one member, which only the shop (1-5) accepts; analytics needs 3-6.
        mvc.perform(authorized(get(templates()).param("fit", "true"), admin))
                .andExpect(jsonPath("$.items[*].id", contains(shopId.intValue())));
        mvc.perform(authorized(get(templates()).param("fit", "true").param("teamId", "999999"), admin))
                .andExpect(jsonPath("$.total").value(0));
        mvc.perform(authorized(get(templates()).param("sort", "CODE").param("size", "1").param("page", "1"), admin))
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.items[*].id", contains(shopId.intValue())));
        mvc.perform(authorized(get(templates()).param("page", "5"), admin))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items", hasSize(0)));
        mvc.perform(authorized(get(templates()).param("size", "500"), admin))
                .andExpect(jsonPath("$.size").value(AssignmentCatalogService.MAX_PAGE_SIZE));
    }

    @Test
    void briefReturnsThePublishedProblemStatementIncludingModules() throws Exception {
        mvc.perform(authorized(get(templates() + "/" + shopId + "/brief").param("versionId", shopVersionId.toString()), admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.versionId").value(shopVersionId))
                .andExpect(jsonPath("$.version").value("v2"))
                .andExpect(jsonPath("$.category").value("Web"))
                .andExpect(jsonPath("$.master.name").value("E-commerce Platform"))
                .andExpect(jsonPath("$.master.description").value("Build an online shop."))
                .andExpect(jsonPath("$.master.level").value("INTERMEDIATE"))
                .andExpect(jsonPath("$.master.maxMembers").value(5))
                .andExpect(jsonPath("$.master.milestones[0].title").value("Design"))
                .andExpect(jsonPath("$.master.milestones[0].dueUnit").value("WEEKS"))
                .andExpect(jsonPath("$.master.milestones[0].weight").value(30))
                .andExpect(jsonPath("$.master.milestones[0].checklist[0].content").value("ERD approved"))
                .andExpect(jsonPath("$.master.milestones[0].rubric.name").value("Design review"))
                .andExpect(jsonPath("$.master.milestones[0].rubric.version").value("v1"))
                .andExpect(jsonPath("$.master.milestones[0].rubric.legacy").value(false))
                .andExpect(jsonPath("$.master.milestones[0].rubric.totalMaxScore").value(10))
                .andExpect(jsonPath("$.master.milestones[0].rubric.criteria[0].code").value("MODEL"))
                .andExpect(jsonPath("$.master.milestones[0].rubric.criteria[0].weight").value(60))
                .andExpect(jsonPath("$.master.milestones[0].rubric.criteria[0].ratings", hasSize(1)))
                .andExpect(jsonPath("$.master.milestones[0].rubric.criteria[1].ratings", hasSize(4)))
                .andExpect(jsonPath("$.master.milestones[0].rubric.criteria[0].ratings[0].level").value("EXCELLENT"))
                .andExpect(jsonPath("$.master.milestones[0].rubric.criteria[0].ratings[0].description").value("Fully normalized"))
                // An unknown rubric version falls back to the criteria embedded in the snapshot.
                .andExpect(jsonPath("$.master.milestones[1].rubric.legacy").value(true))
                .andExpect(jsonPath("$.master.milestones[1].rubric.totalMaxScore").value(10))
                .andExpect(jsonPath("$.master.milestones[1].rubric.criteria[*].name", contains("Live demo", "Q&A")))
                .andExpect(jsonPath("$.master.modules[0].milestones[0].rubric").doesNotExist())
                .andExpect(jsonPath("$.master.backlogItems[0].suggestedRole").value("DEV"))
                .andExpect(jsonPath("$.master.modules[0].templateId").value(cartId))
                .andExpect(jsonPath("$.master.modules[0].description").value("Basket and checkout"))
                .andExpect(jsonPath("$.master.modules[0].maxMembers").value(3))
                .andExpect(jsonPath("$.master.modules[0].milestones[*].title", containsInAnyOrder("Cart API")));
    }

    @Test
    void briefRejectsAnOutdatedVersionAndUsersWithoutAllocationRights() throws Exception {
        mvc.perform(authorized(get(templates() + "/" + shopId + "/brief").param("versionId", "999999"), admin))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PROJECT_ASSIGNMENT_VERSION_CHANGED"));
        mvc.perform(authorized(get(templates() + "/" + shopId + "/brief"), student)).andExpect(status().isForbidden());
        mvc.perform(authorized(get(templates()), student)).andExpect(status().isForbidden());
    }

    private UUID publishedRubric(Long tenantId) {
        UUID actor = UUID.randomUUID();
        Instant now = Instant.parse("2026-01-01T00:00:00Z");
        Rubric rubric = Rubric.create(UUID.randomUUID(), RubricTenantIdentity.from(tenantId), "Design review", null, actor, now);
        RubricVersion version = RubricVersion.draft(UUID.randomUUID(), rubric, 1, actor, now);
        version.replaceDraft("Design review", "Graded at the design milestone", List.of(
                new RubricVersion.CriterionValue("MODEL", "Data model", "ERD quality", new BigDecimal("60.00"),
                        new BigDecimal("6.00"), 0, List.of(new RubricVersion.RatingValue(RubricRatingLevel.EXCELLENT, "Fully normalized"))),
                new RubricVersion.CriterionValue("UI", "Wireframes", null, new BigDecimal("40.00"),
                        new BigDecimal("4.00"), 1)), actor, now);
        version.publish(actor, now.plusSeconds(60));
        rubric.addVersion(version);
        em.persist(rubric);
        em.flush();
        return version.getId();
    }

    private String templates() {
        return "/api/v1/classes/" + classId + "/allocation-sessions/" + sessionId + "/project-assignments/templates";
    }

    private MockHttpServletRequestBuilder authorized(MockHttpServletRequestBuilder request, String token) {
        return request.header("Authorization", "Bearer " + token);
    }

    private User user(Tenant tenant, String role, String label) {
        var user = new User();
        user.setEmail(UUID.randomUUID() + "@catalogue.test");
        user.setPasswordHash("unused");
        user.setFirstName(label);
        user.setLastName("Test");
        user.setUserCode("C-" + UUID.randomUUID());
        user.setTenant(tenant);
        user.setRoles(new HashSet<>(Set.of(roles.findByName(role).orElseThrow())));
        em.persist(user);
        em.flush();
        return user;
    }

    private String token(User user) {
        var principal = details.loadUserByUsername(user.getEmail());
        return tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    private ProjectTemplate template(Long tenantId, ProjectTemplate parent, String code, String name, ProjectTemplateStatus status) {
        var template = new ProjectTemplate();
        template.setTenantId(tenantId);
        template.setParentTemplate(parent);
        template.setCode(code);
        template.setName(name);
        template.setStatus(status);
        template.setConstraintsJson("{\"min_members\":1,\"max_members\":5}");
        em.persist(template);
        em.flush();
        return template;
    }

    private ProjectTemplateSnapshot snapshot(Long templateId, String version, ProjectTemplateVersionStatus status, String content) {
        var snapshot = new ProjectTemplateSnapshot();
        snapshot.setTemplateId(templateId);
        snapshot.setVersion(version);
        snapshot.setStatus(status);
        snapshot.setContentJson(content);
        em.persist(snapshot);
        em.flush();
        return snapshot;
    }
}
