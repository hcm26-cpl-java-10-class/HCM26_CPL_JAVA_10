package com.example.starter_project_2025.system.schedule.trainingclass;

import com.example.starter_project_2025.StarterProject2025Application;
import com.example.starter_project_2025.init.TrainingClassDemoDataInitializer;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes = StarterProject2025Application.class, properties = {
        "spring.datasource.url=jdbc:h2:mem:training_class_revisions;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.show-sql=false", "logging.level.org.hibernate.SQL=OFF",
        "app.seed.admin.email=class-admin@example.com", "app.seed.admin.password=class-test-password"
})
@ActiveProfiles("dev1-demo")
@AutoConfigureMockMvc
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class TrainingClassApiIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired TrainingClassRepository repository;
    @Autowired TrainingClassRevisionRepository revisions;
    @Autowired TrainingClassExceptionHandler handler;
    @Autowired TrainingClassDemoDataInitializer fixtures;
    @Autowired RoleRepository roles;
    @Autowired UserRepository users;
    @Autowired PermissionRepository permissions;
    @Autowired PasswordEncoder passwords;
    private String adminToken, editorToken, reviewerToken, readerToken;
    private final AtomicLong codes = new AtomicLong();
    private static final List<String> FIELDS = List.of("name", "description", "traineeType", "deliveryFormat", "site", "location", "startDate", "endDate", "capacity");

    @BeforeAll void login() throws Exception {
        adminToken = token("class-admin@example.com", "class-test-password");
        editorToken = actor("CLASS_EDITOR_TEST", "class-editor@example.com", List.of("TRAINING_CLASS_READ", "TRAINING_CLASS_CREATE", "TRAINING_CLASS_UPDATE", "TRAINING_CLASS_SUBMIT"));
        reviewerToken = actor("CLASS_REVIEWER_TEST", "class-reviewer@example.com", List.of("TRAINING_CLASS_READ", "TRAINING_CLASS_APPROVE"));
        readerToken = actor("CLASS_READER_TEST", "class-reader@example.com", List.of("TRAINING_CLASS_READ"));
    }

    private String actor(String roleName, String email, List<String> names) throws Exception {
        Role role = roles.saveAndFlush(Role.builder().name(roleName).permissions(new HashSet<>(names.stream()
                .map(name -> permissions.findByName(name).orElseThrow()).toList())).build());
        users.saveAndFlush(User.builder().email(email).firstName("Class test").lastName("User").passwordHash(passwords.encode("test-password"))
                .roles(new HashSet<>(Set.of(role))).build());
        return token(email, "test-password");
    }

    private String token(String email, String password) throws Exception {
        return read(mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("email", email).put("password", password).toString()))
                .andExpect(status().isOk())).path("accessToken").asText();
    }
    private ResultActions as(String token, MockHttpServletRequestBuilder request) throws Exception { return mvc.perform(request.header("Authorization", "Bearer " + token)); }
    private ResultActions admin(MockHttpServletRequestBuilder request) throws Exception { return as(adminToken, request); }
    private ObjectNode read(ResultActions result) throws Exception { return (ObjectNode) json.readTree(result.andReturn().getResponse().getContentAsString()); }
    private ObjectNode payload() {
        return json.createObjectNode().put("code", "REV-CLASS-" + codes.incrementAndGet()).put("name", "Original class").put("description", " Notes ")
                .put("openClassRequestId", 101).put("programVersionId", 1).put("traineeType", "FRESHER").put("deliveryFormat", "OFFLINE")
                .put("site", "HCM").put("location", "Room A").put("startDate", "2026-10-01").put("endDate", "2026-12-01").put("capacity", 25);
    }
    private ObjectNode create() throws Exception { return read(admin(post("/api/classes").contentType(MediaType.APPLICATION_JSON).content(payload().toString())).andExpect(status().isCreated())); }
    private ObjectNode root(long id) throws Exception { return read(admin(get("/api/classes/" + id)).andExpect(status().isOk())); }
    private long id(ObjectNode root) { return root.path("id").asLong(); }
    private JsonNode history(ObjectNode root) throws Exception { return json.readTree(admin(get("/api/classes/" + id(root) + "/revisions")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()); }
    private ObjectNode pending(ObjectNode root) throws Exception {
        for (JsonNode revision : history(root)) if (revision.path("id").asLong() == root.path("pendingRevisionId").asLong()) return (ObjectNode) revision;
        throw new AssertionError("No pending revision");
    }
    private ObjectNode body(ObjectNode root) throws Exception {
        ObjectNode revision = pending(root), body = root.deepCopy();
        FIELDS.forEach(field -> body.set(field, revision.get(field)));
        return body.put("revisionId", revision.path("id").asLong()).put("revisionVersion", revision.path("version").asLong());
    }
    private ResultActions update(ObjectNode body) throws Exception { return admin(put("/api/classes/" + id(body)).contentType(MediaType.APPLICATION_JSON).content(body.toString())); }
    private MockHttpServletRequestBuilder actionRequest(ObjectNode root, String action, String reason) throws Exception {
        ObjectNode revision = pending(root);
        return post("/api/classes/" + id(root) + "/revisions/" + revision.path("id").asLong() + "/" + action).contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("version", root.path("version").asLong()).put("revisionVersion", revision.path("version").asLong()).put("reason", reason).toString());
    }
    private ObjectNode act(ObjectNode root, String action) throws Exception { return read(admin(actionRequest(root, action, "Needs correction")).andExpect(status().isOk())); }
    private ObjectNode publish(ObjectNode root) throws Exception { return act(act(root,"submit"), "approve"); }
    private ObjectNode newDraft(ObjectNode root) throws Exception {
        return read(admin(post("/api/classes/" + id(root) + "/revisions").contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("version", root.path("version").asLong()).toString())).andExpect(status().isCreated()));
    }
    private ObjectNode ongoing() throws Exception {
        ObjectNode root = publish(create());
        TrainingClass stored = repository.findById(id(root)).orElseThrow();
        stored.setStatus(ClassStatus.ONGOING); repository.saveAndFlush(stored);
        return root(id(root));
    }

    @Test void createProducesUnpublishedDraftV1AndCannotBeUsedAsPublishedClass() throws Exception {
        ObjectNode root = create();
        assertEquals("PLANNING", root.path("status").asText());
        assertTrue(root.path("currentRevisionId").isNull());
        assertEquals(1, root.path("pendingRevisionNo").asInt());
        assertEquals("DRAFT", pending(root).path("status").asText());
        assertEquals("Notes", pending(root).path("description").asText());
        admin(get("/api/classes/" + id(root) + "/published")).andExpect(status().isNotFound());
    }

    @Test void firstApprovalAllowsSelfApprovalAndKeepsClassPlanning() throws Exception {
        ObjectNode root = publish(create());
        assertEquals("PLANNING", root.path("status").asText());
        assertEquals(1, root.path("currentRevisionNo").asInt());
        assertTrue(root.path("pendingRevisionId").isNull());
        JsonNode revision = history(root).get(0);
        assertEquals("ACTIVE", revision.path("status").asText());
        assertEquals(revision.path("submittedBy"), revision.path("reviewedBy"));
        assertFalse(revision.path("reviewedAt").isNull());
        admin(get("/api/classes/" + id(root) + "/published")).andExpect(status().isOk());
    }

    @Test void ongoingDraftV2NeverChangesPublishedInformationUntilApproved() throws Exception {
        ObjectNode active = ongoing(), draft = newDraft(active);
        long classId = id(active); long classCount = repository.count();
        ObjectNode saved = read(update(body(draft).put("name", " Proposed class ").put("description", " Draft notes ")).andExpect(status().isOk()));
        assertEquals("Original class", saved.path("name").asText());
        admin(get("/api/classes/" + classId + "/published")).andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Original class"));
        assertEquals("Proposed class", pending(saved).path("name").asText());
        ObjectNode submitted = act(saved, "submit");
        assertEquals("Original class", submitted.path("name").asText());
        ObjectNode approved = act(submitted, "approve");
        assertEquals(classId, id(approved)); assertEquals(classCount, repository.count());
        assertEquals("ONGOING", approved.path("status").asText());
        assertEquals("Proposed class", approved.path("name").asText());
        assertEquals("Draft notes", approved.path("description").asText());
        assertEquals(2, approved.path("currentRevisionNo").asInt());
        JsonNode versions = history(approved);
        assertEquals("ACTIVE", versions.get(0).path("status").asText());
        assertEquals("ARCHIVED", versions.get(1).path("status").asText());
        assertEquals("Original class", versions.get(1).path("name").asText());
    }

    @Test void rejectionPreservesActiveAndNextDraftUsesActiveWithMonotonicNumber() throws Exception {
        ObjectNode draft = newDraft(ongoing());
        ObjectNode saved = read(update(body(draft).put("name", "Rejected proposal")).andExpect(status().isOk()));
        ObjectNode rejected = act(act(saved,"submit"),"reject");
        assertEquals("Original class", rejected.path("name").asText());
        assertEquals(1, rejected.path("currentRevisionNo").asInt());
        assertEquals("REJECTED", history(rejected).get(0).path("status").asText());
        assertEquals("Needs correction", history(rejected).get(0).path("rejectionReason").asText());
        ObjectNode next = newDraft(rejected);
        assertEquals(3, next.path("pendingRevisionNo").asInt());
        assertEquals("Original class", pending(next).path("name").asText());
        assertEquals(next.path("currentRevisionId"), pending(next).path("baseRevisionId"));
    }

    @Test void reviewIsImmutableAndApproveRequiresSubmission() throws Exception {
        ObjectNode draft = create();
        admin(actionRequest(draft,"approve",null)).andExpect(status().isConflict());
        ObjectNode submitted = act(draft,"submit");
        update(body(submitted).put("name", "Cannot edit review")).andExpect(status().isConflict());
        admin(actionRequest(submitted,"submit",null)).andExpect(status().isConflict());
        admin(actionRequest(submitted,"reject"," ")).andExpect(status().isBadRequest());
    }

    @Test void classAndDraftVersionsPreventSilentOverwrite() throws Exception {
        ObjectNode draft = create(), stale = body(draft);
        ObjectNode changed = read(update(body(draft).put("name","First editor")).andExpect(status().isOk()));
        update(stale.put("name","Stale editor")).andExpect(status().isConflict()).andExpect(jsonPath("$.errors.version").isArray())
                .andExpect(jsonPath("$.currentVersion").value(changed.path("version").asLong()));
        ObjectNode staleRevision = body(changed).put("revisionVersion", 9999);
        update(staleRevision).andExpect(status().isConflict());
        assertEquals("First editor", pending(root(id(draft))).path("name").asText());
    }

    @Test void concurrentDraftCreationCreatesExactlyOneOpenRevision() throws Exception {
        ObjectNode active = ongoing();
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        Callable<Integer> create = () -> { start.await(); return admin(post("/api/classes/"+id(active)+"/revisions")
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":"+active.path("version").asLong()+"}"))
                .andReturn().getResponse().getStatus(); };
        try {
            Future<Integer> first = pool.submit(create), second = pool.submit(create); start.countDown();
            assertEquals(List.of(201,409), List.of(first.get(15,TimeUnit.SECONDS),second.get(15,TimeUnit.SECONDS)).stream().sorted().toList());
        } finally { pool.shutdownNow(); }
        ObjectNode root = root(id(active));
        assertEquals(2, history(root).size()); assertEquals(2, root.path("pendingRevisionNo").asInt());
    }

    @ParameterizedTest
    @CsvSource({"capacity,30", "endDate,2026-12-02", "location,Room B", "site,LONG_AN", "traineeType,INTERN", "deliveryFormat,ONLINE"})
    void operationalChangesCanBeProposedButCannotPublishWithoutDependencyChecks(String field, String value) throws Exception {
        ObjectNode active = ongoing(), draft = newDraft(active), body = body(draft);
        if (field.equals("capacity")) body.put(field,Integer.parseInt(value)); else body.put(field,value);
        if (field.equals("site")) body.put("location", "Long An - Room A");
        ObjectNode submitted = act(read(update(body).andExpect(status().isOk())),"submit");
        assertTrue(pending(submitted).path("dependencyValidationRequired").asBoolean());
        admin(actionRequest(submitted,"approve",null)).andExpect(status().isServiceUnavailable());
        ObjectNode unchanged = root(id(active));
        assertEquals(active.get(field), unchanged.get(field));
        assertEquals(1, unchanged.path("currentRevisionNo").asInt());
        assertEquals("UNDER_REVIEW", pending(unchanged).path("status").asText());
        assertEquals("ACTIVE", history(unchanged).get(1).path("status").asText());
    }

    @Test void revisionFromAnotherClassCannotBeMutated() throws Exception {
        ObjectNode first = create(), second = create(), body = body(first);
        body.put("revisionId", second.path("pendingRevisionId").asLong());
        update(body).andExpect(status().isConflict());
        admin(post("/api/classes/"+id(first)+"/revisions/"+second.path("pendingRevisionId").asLong()+"/submit")
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":"+first.path("version").asLong()+",\"revisionVersion\":0}"))
                .andExpect(status().isConflict());
    }

    @Test void permissionsSeparateEditingSubmittingAndApproving() throws Exception {
        ObjectNode draft = read(as(editorToken,post("/api/classes").contentType(MediaType.APPLICATION_JSON).content(payload().toString())).andExpect(status().isCreated()));
        ObjectNode submitted = read(as(editorToken,actionRequest(draft,"submit",null)).andExpect(status().isOk()));
        as(editorToken,actionRequest(submitted,"approve",null)).andExpect(status().isForbidden());
        ObjectNode approved = read(as(reviewerToken,actionRequest(submitted,"approve",null)).andExpect(status().isOk()));
        as(reviewerToken,post("/api/classes/"+id(approved)+"/revisions").contentType(MediaType.APPLICATION_JSON)
                .content("{\"version\":"+approved.path("version").asLong()+"}")).andExpect(status().isForbidden());
    }

    @Test void readOnlyActorsCannotSeeUnpublishedClassesOrDraftSnapshots() throws Exception {
        ObjectNode draft = create();
        as(readerToken,get("/api/classes/"+id(draft))).andExpect(status().isNotFound());
        as(readerToken,get("/api/classes").param("search",draft.path("code").asText())).andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        as(readerToken,get("/api/classes/"+id(draft)+"/revisions")).andExpect(status().isForbidden());
        ObjectNode published = publish(draft);
        as(readerToken,get("/api/classes/"+id(published)+"/published")).andExpect(status().isOk());
    }

    @ParameterizedTest @CsvSource({"COMPLETED", "CANCELLED"})
    void terminalClassesCannotHaveNewDrafts(String state) throws Exception {
        ObjectNode root = publish(create()); TrainingClass stored=repository.findById(id(root)).orElseThrow();
        stored.setStatus(ClassStatus.valueOf(state)); repository.saveAndFlush(stored);
        ObjectNode latest = root(id(root));
        admin(post("/api/classes/"+id(root)+"/revisions").contentType(MediaType.APPLICATION_JSON)
                .content("{\"version\":"+latest.path("version").asLong()+"}")).andExpect(status().isConflict());
    }

    @Test void inactiveClassRetainsCodeAndCannotPublish() throws Exception {
        ObjectNode draft = create(); admin(delete("/api/classes/"+id(draft))).andExpect(status().isNoContent());
        update(body(draft)).andExpect(status().isConflict());
        admin(post("/api/classes").contentType(MediaType.APPLICATION_JSON).content(payload().put("code",draft.path("code").asText()).toString())).andExpect(status().isConflict());
    }

    @Test void duplicateCodeAndImmutableReferencesAreEnforced() throws Exception {
        ObjectNode draft = create();
        admin(post("/api/classes").contentType(MediaType.APPLICATION_JSON).content(payload().put("code"," "+draft.path("code").asText()+" ").toString()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.errors.code").isArray());
        update(body(draft).put("code","OTHER-CODE")).andExpect(status().isConflict());
        update(body(draft).put("programVersionId",2)).andExpect(status().isConflict());
    }

    @ParameterizedTest @CsvSource({"code,''", "name,''", "capacity,0", "endDate,2026-09-01", "traineeType,UNSUPPORTED"})
    void basicValidationStillApplies(String field, String value) throws Exception {
        ObjectNode body=payload(); if(field.equals("capacity")) body.put(field,Integer.parseInt(value)); else body.put(field,value);
        admin(post("/api/classes").contentType(MediaType.APPLICATION_JSON).content(body.toString())).andExpect(status().isBadRequest());
    }

    @Test void missingVersionAndDraftIdentityAreRejected() throws Exception {
        ObjectNode root=create(), body=body(root); body.remove("version");
        update(body).andExpect(status().isBadRequest());
        body=body(root); body.remove("revisionId"); update(body).andExpect(status().isBadRequest());
    }

    @Test void fixturesIncludeApprovalStatesAndAreIdempotent() throws Exception {
        for (String code: List.of("PLANNING","ONGOING","COMPLETED","CANCELLED","DRAFT","REVIEW")) {
            admin(get("/api/classes").param("search","DEV1-JAVA-"+code)).andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        }
        long count=repository.count(), revisionCount=revisions.count(); fixtures.run();
        assertEquals(count,repository.count()); assertEquals(revisionCount,revisions.count());
    }

    @Test void databaseStillEnforcesCodeUniquenessAndOptimisticLocking() throws Exception {
        ObjectNode root=create(); TrainingClass existing=repository.findById(id(root)).orElseThrow();
        TrainingClass duplicate=TrainingClass.builder().code(existing.getCode()).name("Duplicate").programVersionId(1L)
                .traineeType("FRESHER").deliveryFormat("ONLINE").site("HCM").location("Room B")
                .startDate(existing.getStartDate()).endDate(existing.getEndDate()).capacity(10).build();
        DataIntegrityViolationException collision=assertThrows(DataIntegrityViolationException.class,()->repository.saveAndFlush(duplicate));
        assertEquals(409,handler.duplicateCode(collision).getStatusCode().value());
        TrainingClass stale=repository.findById(existing.getId()).orElseThrow(); existing.setDescription("Updated"); repository.saveAndFlush(existing);
        stale.setDescription("Stale"); assertThrows(ObjectOptimisticLockingFailureException.class,()->repository.saveAndFlush(stale));
    }

    @ParameterizedTest
    @CsvSource({"code,255", "name,255", "description,2000"})
    void createAndEditRejectTextOverLimitsButAcceptTheBoundary(String field, int limit) throws Exception {
        ObjectNode createBody = payload().put(field, "X".repeat(limit + 1));
        admin(post("/api/classes").contentType(MediaType.APPLICATION_JSON).content(createBody.toString()))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors." + field).isArray());
        createBody.put(field, "X".repeat(limit));
        ObjectNode draft = read(admin(post("/api/classes").contentType(MediaType.APPLICATION_JSON)
                .content(createBody.toString())).andExpect(status().isCreated()));
        update(body(draft).put(field, "Y".repeat(limit + 1))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors." + field).isArray());
    }

    @ParameterizedTest
    @CsvSource({"1", "50"})
    void capacityAcceptsBothAllowedBoundaries(int capacity) throws Exception {
        ObjectNode draft = read(admin(post("/api/classes").contentType(MediaType.APPLICATION_JSON)
                .content(payload().put("capacity", capacity).toString())).andExpect(status().isCreated()));
        assertEquals(capacity, draft.path("capacity").asInt());
        update(body(draft).put("capacity", capacity == 1 ? 50 : 1)).andExpect(status().isOk());
    }

    @ParameterizedTest
    @CsvSource({"0", "-1", "51", "1000", "25.5", "1e3", "\"abc\"", "\"50\"", "999999999999999999999999999"})
    void capacityRejectsInvalidNumbersAndTextOnCreateAndEdit(String raw) throws Exception {
        ObjectNode createBody = payload(); createBody.set("capacity", json.readTree(raw));
        admin(post("/api/classes").contentType(MediaType.APPLICATION_JSON).content(createBody.toString()))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.capacity").isArray());
        ObjectNode draft = create(), updateBody = body(draft); updateBody.set("capacity", json.readTree(raw));
        update(updateBody).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.capacity").isArray());
    }

    @Test void locationMustExistAndBelongToSelectedSite() throws Exception {
        admin(get("/api/classes/create-options")).andExpect(status().isOk()).andExpect(jsonPath("$.locations[0].site").value("HCM"));
        admin(post("/api/classes").contentType(MediaType.APPLICATION_JSON)
                .content(payload().put("location", "Arbitrary text").toString())).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.location").isArray());
        ObjectNode draft = create();
        update(body(draft).put("site", "LONG_AN")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.location").isArray());
        ObjectNode saved = read(update(body(draft).put("site", "LONG_AN").put("location", "Long An - Room B")).andExpect(status().isOk()));
        assertEquals("Long An - Room B", pending(saved).path("location").asText());
    }

    @Test void ongoingStartDateCannotBeChangedEvenInADraft() throws Exception {
        ObjectNode active = ongoing(), draft = newDraft(active);
        update(body(draft).put("name", "Must not partially save").put("startDate", "2026-10-02"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.startDate").isArray());
        assertEquals(active.path("startDate"), pending(root(id(draft))).path("startDate"));
        assertEquals(active.path("name"), pending(root(id(draft))).path("name"));
    }

    @Test void planningDraftStartDateIsEditable() throws Exception {
        ObjectNode draft = create();
        ObjectNode saved = read(update(body(draft).put("startDate", "2026-10-02")).andExpect(status().isOk()));
        assertEquals("2026-10-02", pending(saved).path("startDate").asText());
    }

    @ParameterizedTest @CsvSource({"submit", "approve"})
    void startDateIsRecheckedIfClassBecameOngoingAfterDraftWasCreated(String action) throws Exception {
        ObjectNode published = publish(create()), draft = newDraft(published);
        ObjectNode saved = read(update(body(draft).put("startDate", "2026-10-02")).andExpect(status().isOk()));
        if (action.equals("approve")) saved = act(saved, "submit");
        TrainingClass stored = repository.findById(id(saved)).orElseThrow();
        stored.setStatus(ClassStatus.ONGOING); repository.saveAndFlush(stored);
        ObjectNode latest = root(id(saved));
        admin(actionRequest(latest, action, null)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.startDate").isArray());
        assertEquals(published.path("currentRevisionId"), root(id(saved)).path("currentRevisionId"));
    }

    @Test void databaseRejectsCapacityAboveFifty() throws Exception {
        ObjectNode draft = create();
        TrainingClass stored = repository.findById(id(draft)).orElseThrow(); stored.setCapacity(51);
        assertThrows(DataIntegrityViolationException.class, () -> repository.saveAndFlush(stored));
        TrainingClassRevision revision = revisions.findById(draft.path("pendingRevisionId").asLong()).orElseThrow(); revision.setCapacity(51);
        assertThrows(DataIntegrityViolationException.class, () -> revisions.saveAndFlush(revision));
    }
}
