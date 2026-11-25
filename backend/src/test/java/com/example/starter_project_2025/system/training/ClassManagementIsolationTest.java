package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.exception.*;
import com.example.starter_project_2025.system.training.*;
import com.example.starter_project_2025.system.training.entity.TrainingClass;
import com.example.starter_project_2025.system.external_api.ExternalApiService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.*;
import org.springframework.core.env.Environment;
import org.springframework.test.context.*;
import jakarta.validation.Validator; import jakarta.validation.Validation;
import javax.sql.DataSource;
import java.time.*;
import java.nio.file.*;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Independent JPA/MockMvc/method-security tests. No live HTTP, JWT login, Swagger or SMTP acceptance. */
@DataJpaTest(showSql=false,properties={"spring.jpa.hibernate.ddl-auto=create","spring.sql.init.mode=never","logging.level.org.hibernate.SQL=OFF","logging.level.org.hibernate.orm.jdbc.bind=OFF","spring.main.banner-mode=off"})
@AutoConfigureTestDatabase(replace=AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("srs-evidence-independent")
@Import({ClassManagementIsolationTest.Stores.class,TrainingClassService.class,ClassStatisticsService.class,ClassReadinessService.class,ClassSetupService.class,ClassSetupController.class,TrainingClassController.class})
class ClassManagementIsolationTest {
 static class MemoryOnly {
  static String verify(DataSource ds) throws Exception {
   try (var c=ds.getConnection()) {
    var meta=c.getMetaData();
    if (!"H2".equals(meta.getDatabaseProductName()) || !URL.equals(meta.getURL()))
     throw new IllegalStateException("Only this test JVM's memory H2 is allowed");
    return meta.getURL();
   }
  }
  DataSource srsDataSource(Environment env) {
   if (!URL.equals(env.getProperty("spring.datasource.url")) || !URL.equals(env.getProperty("spring.datasource.hikari.jdbc-url"))
       || env.containsProperty("spring.datasource.jndi-name")) throw new IllegalStateException("Unexpected datasource configuration");
   var ds=new com.zaxxer.hikari.HikariDataSource(); ds.setDriverClassName("org.h2.Driver"); ds.setJdbcUrl(URL);
   ds.setUsername("sa"); ds.setPassword(""); ds.setMaximumPoolSize(3); return ds;
  }
 }
 static final String URL="jdbc:h2:mem:srs_evidence_"+UUID.randomUUID().toString().replace("-","");
 static final LocalDate DAY=LocalDate.of(2026,11,23);
 static final List<Map<String,Object>> observations=new ArrayList<>();
 @DynamicPropertySource static void props(DynamicPropertyRegistry r){
  r.add("srs.evidence.jdbc-url",()->URL);r.add("spring.datasource.url",()->URL);r.add("spring.datasource.hikari.jdbc-url",()->URL);
 }
 @TestConfiguration @org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity static class Stores {
  @Bean @Primary DataSource isolatedDataSource(Environment env)throws Exception {
   DataSource ds=new MemoryOnly().srsDataSource(env);
   String actual=MemoryOnly.verify(ds);
   if(!actual.equals(URL))throw new IllegalStateException("Memory metadata mismatch before Hibernate schema writes");
   Path out=Path.of(System.getProperty("srs.independent.report-dir", "target/class-management-isolation"));Files.createDirectories(out);
   new ObjectMapper().writeValue(out.resolve("independent-jdbc-attestation.json").toFile(),Map.of("jdbcUrl",actual,"product","H2","verifiedBeforeHibernateSchema",true,"httpServerStarted",false));
   return ds;
  }
  @Bean Validator testValidator(){return Validation.buildDefaultValidatorFactory().getValidator();}
  @Bean Clock trainingClassClock(){return Clock.fixed(Instant.parse("2026-11-23T03:00:00Z"),ZoneId.of("Asia/Ho_Chi_Minh"));}
  @Bean ExternalApiService noExternalNetwork(){return mock(ExternalApiService.class,inv->{throw new AssertionError("Independent suite must not call external directory: "+inv.getMethod().getName());});}
 }
 @Autowired TrainingClassService service; @Autowired TrainingClassRepository repository;
 @Autowired ClassStatisticsService statistics; @Autowired ClassReadinessService readiness;
 @Autowired DataSource ds; @Autowired ExternalApiService directory;
 @Autowired ClassSetupService setup;
 @Autowired ClassSetupController setupController;
 @Autowired TrainingClassController classController;
 @Autowired jakarta.persistence.EntityManager em;
 @Autowired com.example.starter_project_2025.system.trainingprogram.TrainingProgramRepository programRepository;
 @Autowired com.example.starter_project_2025.system.trainingprogram.TeachingAssignmentRepository assignmentRepository;
 org.springframework.test.web.servlet.MockMvc mvc;
 ObjectMapper json = new ObjectMapper().findAndRegisterModules()
     .disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
 Long fixture;
 @BeforeEach void seed()throws Exception{
  reset(directory);
  assertThat(MemoryOnly.verify(ds)).isEqualTo(URL);
  fixture=service.create(row("SRS_TEST_01")).getId();
  service.create(row("SRSXTESTX02"));
  authorize("CLASS_READ", "CLASS_CREATE", "CLASS_UPDATE", "CLASS_DELETE", "PROGRAM_READ", "ASSIGNMENT_READ", "ASSIGNMENT_CREATE", "ASSIGNMENT_UPDATE");
  mvc=org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(classController,setupController)
      .setControllerAdvice(new TrainingClassExceptionHandler(),new com.example.starter_project_2025.exception.GlobalExceptionHandler())
      .setMessageConverters(new org.springframework.http.converter.json.MappingJackson2HttpMessageConverter(json)).build();
 }
 @AfterEach void clearPrincipal(){org.springframework.security.core.context.SecurityContextHolder.clearContext();}
 void authorize(String... rights){
  var authorities=Arrays.stream(rights).map(org.springframework.security.core.authority.SimpleGrantedAuthority::new).toList();
  org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(
      new org.springframework.security.authentication.UsernamePasswordAuthenticationToken("synthetic-class-operator",null,authorities));
 }
 record SetupFixture(Long programId,Long subjectId,Long trainerId) {}
 SetupFixture setupFixture(){
  var program=new com.example.starter_project_2025.system.trainingprogram.TrainingProgram();
  program.setCode("SRS_PROGRAM");program.setName("Synthetic curriculum");program.setVersion("1");
  program.setStatus(com.example.starter_project_2025.system.trainingprogram.ProgramStatus.ACTIVE);
  programRepository.saveAndFlush(program);
  var subject=new com.example.starter_project_2025.system.subject.Subject();
  subject.setCode("SYNTHETIC_TOPIC");subject.setName("Synthetic topic");subject.setVersion("1");subject.setDurationHours(20);
  em.persist(subject);em.flush();
  var ps=new com.example.starter_project_2025.system.trainingprogram.ProgramSubject();
  ps.setProgram(program);ps.setSubject(subject);ps.setOrderIndex(1);em.persist(ps);em.flush();
  var trainer=com.example.starter_project_2025.system.trainer.Trainer.create(
      "SYNTHETIC_TRAINER","Synthetic internal trainer","trainer@example.test",null,
      com.example.starter_project_2025.system.trainer.TrainerStatus.ACTIVE,List.of(subject));
  em.persist(trainer);em.flush();
  var d=service.get(fixture);d.setMasterTrainerId(trainer.getId());d.setMasterTrainer(trainer.getFullName());service.update(fixture,d);
  return new SetupFixture(program.getId(),ps.getId(),trainer.getId());
 }
 String assignmentJson(SetupFixture f, boolean openEnded)throws Exception{
  return json.writeValueAsString(new com.example.starter_project_2025.system.trainingprogram.TeachingAssignmentRequest(
      fixture,f.subjectId(),f.trainerId(),com.example.starter_project_2025.system.trainingprogram.AssignmentRole.MAIN,
      DAY.plusDays(7),openEnded?null:DAY.plusDays(37),"INTERNAL"));
 }
 @Test void setupEndpointsPersistInternalProgramAndMainAssignmentWithLeastPermissions()throws Exception{
  var f=setupFixture();String path="/api/classes/"+fixture;
  authorize("CLASS_READ","PROGRAM_READ","ASSIGNMENT_READ");
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(path+"/setup"))
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.classId").value(fixture));
  authorize("CLASS_READ","CLASS_UPDATE","PROGRAM_READ");
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(path+"/program-link")
      .contentType("application/json").content("{\"programId\":"+f.programId()+"}"))
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk());
  authorize("CLASS_READ","PROGRAM_READ","ASSIGNMENT_CREATE");
  var created=mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(path+"/teaching-assignments")
      .contentType("application/json").content(assignmentJson(f,false)))
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isCreated()).andReturn();
  long id=json.readTree(created.getResponse().getContentAsString()).get("id").asLong();
  authorize("CLASS_READ","PROGRAM_READ","ASSIGNMENT_UPDATE");
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(path+"/teaching-assignments/"+id)
      .contentType("application/json").content(assignmentJson(f,true)))
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk());
  em.clear();
  var saved=assignmentRepository.findById(id).orElseThrow();
  assertThat(saved.getClassId()).isEqualTo(fixture);assertThat(saved.getTrainerSource()).isEqualTo("INTERNAL");
  assertThat(saved.getEffectiveTo()).isNull();assertThat(assignmentRepository.findByClassIdOrderByEffectiveFromAscIdAsc(fixture)).hasSize(1);
  assertThat(readiness.get(fixture).checks().get(1).status()).isEqualTo(ClassReadinessService.State.READY);
  verifyNoInteractions(directory);
 }
 @Test void setupMissingPermissionsReturn403AndDoNotPersist()throws Exception{
  var f=setupFixture();String path="/api/classes/"+fixture;
  authorize("CLASS_READ");
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(path+"/setup"))
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isForbidden());
  authorize("CLASS_READ","PROGRAM_READ","ASSIGNMENT_READ");
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(path+"/program-link")
      .contentType("application/json").content("{\"programId\":"+f.programId()+"}"))
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isForbidden());
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(path+"/teaching-assignments")
      .contentType("application/json").content(assignmentJson(f,false)))
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isForbidden());
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(path+"/teaching-assignments/9999")
      .contentType("application/json").content(assignmentJson(f,false)))
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isForbidden());
  assertThat(assignmentRepository.findByClassIdOrderByEffectiveFromAscIdAsc(fixture)).isEmpty();
 }
 @Test void crudEndpointsValidateAndReadBackSavedRows()throws Exception{
  var created=mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/classes")
      .contentType("application/json").content(json.writeValueAsString(row("SRS_HTTP_CREATE"))))
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isCreated()).andReturn();
  long id=json.readTree(created.getResponse().getContentAsString()).get("id").asLong();
  var edit=service.get(id);edit.setName("Changed synthetic class");
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/classes/"+id)
      .contentType("application/json").content(json.writeValueAsString(edit)))
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk());
  em.clear();assertThat(service.get(id).getName()).isEqualTo("Changed synthetic class");
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/classes/"+id))
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.id").value(id));
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/classes").contentType("application/json").content("{}"))
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isBadRequest());
 }
 @Test void invalidDatesAndStartedClassDeletionRemainRejected()throws Exception{
  var edit=service.get(fixture);edit.setEndDate(edit.getStartDate());
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/classes/"+fixture)
      .contentType("application/json").content(json.writeValueAsString(edit)))
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isBadRequest());
  for(String status:List.of("assigned","active")){var d=service.get(fixture);d.setStatus(status);service.update(fixture,d);}
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/classes/"+fixture))
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isConflict());
  assertThat(service.get(fixture).getStatus()).isEqualTo("active");
 }
 @org.junit.jupiter.params.ParameterizedTest
 @org.junit.jupiter.params.provider.CsvSource({"planning,assigned","assigned,planning","assigned,active","active,completed","completed,closed","planning,cancelled","assigned,cancelled","active,cancelled"})
 void lifecycleEndpointUsesSeparateFixtureForEachValidTransition(String initial,String target)throws Exception{
  var entity=repository.findById(fixture).orElseThrow();entity.setStatus(initial);repository.saveAndFlush(entity);
  var d=service.get(fixture);d.setStatus(target);
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/classes/"+fixture)
      .contentType("application/json").content(json.writeValueAsString(d)))
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk());
  em.clear();assertThat(service.get(fixture).getStatus()).isEqualTo(target);
 }
 @Test void importJsonPersistsExactCountAndInvalidBatchWritesNothing()throws Exception{
  long before=repository.count();
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/classes/import")
      .contentType("application/json").content(json.writeValueAsString(List.of(row("SRS_JSON_01"),row("SRS_JSON_02")))))
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk());
  assertThat(repository.count()).isEqualTo(before+2);
  var invalid=row("SRS_JSON_BAD");invalid.setEndDate(invalid.getStartDate());
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/classes/import")
      .contentType("application/json").content(json.writeValueAsString(List.of(row("SRS_JSON_GOOD"),invalid))))
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isBadRequest());
  assertThat(repository.count()).isEqualTo(before+2);
 }
 @Test void statisticsAndReadinessEndpointsMatchTheSameMemoryDatabase()throws Exception{
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/classes/stats"))
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.totalClasses").value(statistics.get().totalClasses()));
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/classes/"+fixture+"/readiness"))
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.checks.length()").value(5))
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.unknown").value(readiness.get(fixture).unknown()));
 }
 @Test void deactivateEndpointReturns204AndKeepsInactiveRow()throws Exception{
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/classes/"+fixture))
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isNoContent());
  em.flush();em.clear();assertThat(repository.findById(fixture).orElseThrow().getIsActive()).isFalse();
 }
 @Test void sampleDirectoryLeavesReadinessBlockedInsteadOfInventingReady(){
  var d=service.get(fixture);d.setDeliveryType("Class");d.setFormatType("Offline");d.setLocation("Synthetic room");service.update(fixture,d);
  doReturn(true).when(directory).isSampleData();
  var r=readiness.get(fixture);assertThat(r.checks().get(4).status()).isEqualTo(ClassReadinessService.State.BLOCKED);
  assertThat(r.blocked()).isEqualTo(1);assertThat(r.verified()).isEqualTo(2);
  verify(directory,never()).fetchRooms();
 }
 static TrainingClassDTO row(String code){
  TrainingClassDTO d=new TrainingClassDTO();d.setCode(code);d.setName("Synthetic class "+code);d.setStatus("planning");
  d.setStartDate(DAY.plusDays(7));d.setEndDate(DAY.plusDays(37));d.setPlannedSize(20);d.setSite("SRS test site");
  d.setProgram("SRS_PROGRAM");d.setClassAdmin("Synthetic class administrator");d.setMasterTrainer("Synthetic legacy trainer label");return d;
 }
 TrainingClassService.ClassPage list(int page,int size,String search,String status,String program,LocalDate from,LocalDate to,String sort,String dir){return service.list(page,size,search,status,program,from,to,sort,dir);}
 @Test void actualIdentityAndDtoReflectPersistedClass(){
  var d=service.get(fixture);assertThat(d.getId()).isPositive();assertThat(d.getCode()).isEqualTo("SRS_TEST_01");
  assertThat(d.getEnrolledTrainees()).isZero();assertThat(d.getTraineeSource()).isEqualTo("internal");
  observations.add(Map.of("kind","domainSnapshot","classId",fixture,"code",d.getCode(),"enrolledTrainees",d.getEnrolledTrainees(),"httpExecuted",false));
 }
 @Test void searchEscapesLiteralUnderscoreAndCombinesFilters(){
  var r=list(0,10,"_TEST_","planning","SRS_PROGRAM",DAY.plusDays(7),DAY.plusDays(7),"code","asc");
  assertThat(r.content()).extracting(TrainingClassDTO::getCode).containsExactly("SRS_TEST_01");assertThat(r.totalElements()).isEqualTo(1);
 }
 @Test void paginationIsStableAndCarriesTrueTotal(){
  var a=list(0,1,null,"all",null,null,null,"code","asc");var b=list(1,1,null,"all",null,null,null,"code","asc");
  assertThat(a.totalElements()).isEqualTo(2);assertThat(a.totalPages()).isEqualTo(2);assertThat(a.size()).isEqualTo(1);assertThat(b.number()).isEqualTo(1);
  assertThat(a.content().getFirst().getId()).isNotEqualTo(b.content().getFirst().getId());assertThat(a.programs()).contains("SRS_PROGRAM");
 }
 @Test void rejectsInvalidListParametersBeforeQuery(){
  assertThatThrownBy(()->list(-1,10,null,"all",null,null,null,"code","asc")).isInstanceOf(BadRequestException.class);
  for(int size:List.of(0,101))assertThatThrownBy(()->list(0,size,null,"all",null,null,null,"code","asc")).isInstanceOf(BadRequestException.class);
  assertThatThrownBy(()->list(0,10,null,"invalid",null,null,null,"code","asc")).isInstanceOf(BadRequestException.class);
  assertThatThrownBy(()->list(0,10,null,"all",null,DAY.plusDays(1),DAY,"code","asc")).isInstanceOf(BadRequestException.class);
  assertThatThrownBy(()->list(0,10,null,"all",null,null,null,"invalid","asc")).isInstanceOf(BadRequestException.class);
  assertThatThrownBy(()->list(0,10,null,"all",null,null,null,"code","invalid")).isInstanceOf(BadRequestException.class);
 }
 @Test void createPersistsPlanningAndRejectsCaseInsensitiveDuplicate(){
  var d=service.create(row("SRS_NEW_01"));assertThat(repository.findById(d.getId())).isPresent();
  assertThatThrownBy(()->service.create(row("srs_new_01"))).isInstanceOf(ConflictException.class);assertThat(repository.count()).isEqualTo(3);
 }
 @Test void newClassCannotStartInAssignedState(){
  var d=row("SRS_BAD_01");d.setStatus("assigned");assertThatThrownBy(()->service.create(d)).isInstanceOf(BadRequestException.class);assertThat(repository.count()).isEqualTo(2);
 }
 @Test void lifecycleTransitionsPersistAndClosedCannotReturnToPlanning(){
  for(String status:List.of("assigned","planning","assigned","active","completed","closed")){var d=service.get(fixture);d.setStatus(status);assertThat(service.update(fixture,d).getStatus()).isEqualTo(status);}
  var d=service.get(fixture);d.setStatus("planning");assertThatThrownBy(()->service.update(fixture,d)).isInstanceOf(ConflictException.class);assertThat(service.get(fixture).getStatus()).isEqualTo("closed");
 }
 @Test void startedClassCodeCannotBeChanged(){
  for(String status:List.of("assigned","active")){var d=service.get(fixture);d.setStatus(status);service.update(fixture,d);}
  var d=service.get(fixture);d.setCode("SRS_CHANGED");assertThatThrownBy(()->service.update(fixture,d)).isInstanceOf(ConflictException.class);assertThat(service.get(fixture).getCode()).isEqualTo("SRS_TEST_01");
 }
 @Test void deactivatePreservesRowAndRemovesItFromActiveQueries(){
  service.deactivate(fixture);assertThat(repository.findById(fixture).orElseThrow().getIsActive()).isFalse();
  assertThatThrownBy(()->service.get(fixture)).isInstanceOf(ResourceNotFoundException.class);assertThat(list(0,10,null,"all",null,null,null,"code","asc").totalElements()).isEqualTo(1);
 }
 @Test void importsTwoValidRowsIntoMemory(){
  var result=service.importClasses(List.of(row("SRS_IMPORT_01"),row("SRS_IMPORT_02")));assertThat(result).hasSize(2);assertThat(result).allSatisfy(d->assertThat(d.getId()).isPositive());assertThat(repository.count()).isEqualTo(4);
 }
 @Test void invalidImportPreflightDoesNotWriteTheValidRow(){
  var bad=row("SRS_IMPORT_BAD");bad.setEndDate(DAY);assertThatThrownBy(()->service.importClasses(List.of(row("SRS_IMPORT_GOOD"),bad))).isInstanceOf(BusinessValidationException.class);assertThat(repository.count()).isEqualTo(2);
 }
 @Test void statisticsUseFixedVietnamTimezoneAndInclusiveThirtyDayWindow(){
  for(String status:List.of("active","completed","closed")){var d=service.create(row("SRS_STAT_"+status.toUpperCase()));var e=repository.findById(d.getId()).orElseThrow();e.setStatus(status);repository.saveAndFlush(e);}
  var edge=row("SRS_EDGE_30");edge.setStartDate(DAY.plusDays(30));edge.setEndDate(DAY.plusDays(40));service.create(edge);
  var far=row("SRS_EDGE_31");far.setStartDate(DAY.plusDays(31));far.setEndDate(DAY.plusDays(41));service.create(far);
  var off=service.create(row("SRS_INACTIVE"));service.deactivate(off.getId());
  var s=statistics.get();assertThat(s.totalClasses()).isEqualTo(7);assertThat(s.inProgress()).isEqualTo(1);assertThat(s.completedClasses()).isEqualTo(2);assertThat(s.upcomingClasses()).isEqualTo(3);
  assertThat(s.asOf()).isEqualTo(DAY);assertThat(s.upcomingThrough()).isEqualTo(DAY.plusDays(30));assertThat(s.timezone()).isEqualTo("Asia/Ho_Chi_Minh");
 }
 @Test void readinessReturnsAllFiveGroupsWithoutInventingReadiness(){
  var r=readiness.get(fixture);assertThat(r.checks()).extracting(ClassReadinessService.Check::key).containsExactly("basic","trainer","enrollment","calendar","operations");
  assertThat(r.ready()).isZero();assertThat(r.unknown()).isEqualTo(2);assertThat(r.notReady()).isEqualTo(3);assertThat(r.blocked()).isZero();assertThat(r.ready()+r.notReady()+r.unknown()+r.blocked()).isEqualTo(5);verifyNoInteractions(directory);
  observations.add(Map.of("kind","domainSnapshot","classId",fixture,"ready",r.ready(),"notReady",r.notReady(),"unknown",r.unknown(),"blocked",r.blocked(),"httpExecuted",false));
 }
 @Test void readinessOnlineLocationChecksActualSchemeWithoutExternalCalls(){
  var d=service.get(fixture);d.setDeliveryType("Online");d.setFormatType("Online");d.setLocation("https://example.test/srs-session");service.update(fixture,d);
  assertThat(readiness.get(fixture).checks().stream().filter(c->c.key().equals("operations")).findFirst().orElseThrow().status()).isEqualTo(ClassReadinessService.State.READY);
  d=service.get(fixture);d.setLocation("javascript:invalid");service.update(fixture,d);
  assertThat(readiness.get(fixture).checks().stream().filter(c->c.key().equals("operations")).findFirst().orElseThrow().status()).isEqualTo(ClassReadinessService.State.NOT_READY);verifyNoInteractions(directory);
 }
 @Test void readinessUnsupportedSavedFormatRemainsUnknown(){
  var d=service.get(fixture);d.setDeliveryType("Online");d.setFormatType("Remote");d.setLocation("https://example.test/srs-session");service.update(fixture,d);
  assertThat(readiness.get(fixture).checks().stream().filter(c->c.key().equals("operations")).findFirst().orElseThrow().status()).isEqualTo(ClassReadinessService.State.UNKNOWN);verifyNoInteractions(directory);
 }
 @Test void missingClassIsRejectedByDetailAndReadinessServices(){
  assertThatThrownBy(()->service.get(Long.MAX_VALUE)).isInstanceOf(ResourceNotFoundException.class);assertThatThrownBy(()->readiness.get(Long.MAX_VALUE)).isInstanceOf(ResourceNotFoundException.class);
 }
 @AfterAll static void recordScope()throws Exception{
  new ObjectMapper().writeValue(Path.of(System.getProperty("srs.independent.report-dir", "target/class-management-isolation"),"independent-domain-observations.json").toFile(),Map.of("scope","JPA, MockMvc and method authorization; no live HTTP, JWT login, SMTP or Swagger acceptance","jdbcUrl",URL,"databaseLifetime","Test JVM only; IDs expire when JVM exits","snapshots",observations,"businessApiPass",0,"ucAccepted",0));
 }
}
