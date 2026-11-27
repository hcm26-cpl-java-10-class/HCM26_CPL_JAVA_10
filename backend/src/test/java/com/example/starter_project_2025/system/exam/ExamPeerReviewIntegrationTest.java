package com.example.starter_project_2025.system.exam;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.core.domain.Exam;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptAnswer;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptQuestion;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.exam.core.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.result.domain.ExamResultPublication;
import com.example.starter_project_2025.system.exam.result.domain.ExamResultPublicationRepository;
import com.example.starter_project_2025.system.exam.result.domain.ScoreReleasePolicy;
import com.example.starter_project_2025.system.exam.review.audit.ExamReviewAuditRepository;
import com.example.starter_project_2025.system.exam.review.domain.ExamReviewAssignment;
import com.example.starter_project_2025.system.exam.review.domain.ExamReviewAssignmentRepository;
import com.example.starter_project_2025.system.exam.review.domain.ExamReviewStatus;
import com.example.starter_project_2025.system.exam.review.domain.ExamReviewType;
import com.example.starter_project_2025.system.exam.review.dto.ExamReviewAssignmentDTO;
import com.example.starter_project_2025.system.exam.review.dto.ExamReviewAssignResultDTO;
import com.example.starter_project_2025.system.exam.review.dto.ExamReviewFeedbackDTO;
import com.example.starter_project_2025.system.exam.review.dto.ExamReviewSubmitRequest;
import com.example.starter_project_2025.system.exam.review.dto.ExamReviewTargetDTO;
import com.example.starter_project_2025.system.exam.review.service.ExamPeerReviewService;
import com.example.starter_project_2025.system.exam.review.service.ExamReviewConflictException;
import com.example.starter_project_2025.system.exam.review.service.ExamReviewForbiddenException;
import com.example.starter_project_2025.system.exam.review.service.ExamReviewValidationException;
import com.example.starter_project_2025.system.question.core.domain.EssayGradingCriterion;
import com.example.starter_project_2025.system.question.core.domain.Question;
import com.example.starter_project_2025.system.question.core.domain.QuestionRepository;
import com.example.starter_project_2025.system.question.core.domain.QuestionType;
import com.example.starter_project_2025.system.question.core.domain.Difficulty;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * UFR-EXM-012 - Tu danh gia / danh gia cheo (pham vi chi module Exam).
 */
@ActiveProfiles("test")
@SpringBootTest
@Transactional
class ExamPeerReviewIntegrationTest {

    private static final String CRITERION_A = "Content accuracy";
    private static final String CRITERION_B = "Explanation clarity";

    @Autowired
    private ExamPeerReviewService peerReviewService;

    @Autowired
    private ExamRepository examRepository;

    @Autowired
    private ExamAttemptRepository attemptRepository;

    @Autowired
    private ExamResultPublicationRepository publicationRepository;

    @Autowired
    private ExamReviewAssignmentRepository assignmentRepository;

    @Autowired
    private ExamReviewAuditRepository auditRepository;

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    private User teacher;
    private User studentA;
    private User studentB;
    private User studentC;
    private User outsider;
    private Exam exam;
    private Question essayQuestion;

    @BeforeEach
    void setUp() {
        Role teacherRole = roleRepository.findByName("TEACHER").orElseGet(() ->
                roleRepository.save(Role.builder().name("TEACHER").build()));
        Role studentRole = roleRepository.findByName("STUDENT").orElseGet(() ->
                roleRepository.save(Role.builder().name("STUDENT").build()));

        teacher = createUser("peer_teacher@example.com", "Peer", "Teacher", teacherRole);
        studentA = createUser("peer_student_a@example.com", "Alice", "A", studentRole);
        studentB = createUser("peer_student_b@example.com", "Bob", "B", studentRole);
        studentC = createUser("peer_student_c@example.com", "Carol", "C", studentRole);
        outsider = createUser("peer_outsider@example.com", "Out", "Sider", studentRole);

        essayQuestion = new Question();
        essayQuestion.setContent("Explain the SOLID principles.");
        essayQuestion.setType(QuestionType.ESSAY);
        essayQuestion.setDifficulty(Difficulty.MEDIUM);
        essayQuestion.setPoints(10);
        essayQuestion.setIsActive(true);
        List<EssayGradingCriterion> criteria = new ArrayList<>();
        EssayGradingCriterion c1 = new EssayGradingCriterion();
        c1.setName(CRITERION_A);
        c1.setDescription("Correct and complete content");
        c1.setWeightPercentage(60);
        EssayGradingCriterion c2 = new EssayGradingCriterion();
        c2.setName(CRITERION_B);
        c2.setDescription("Clear structure");
        c2.setWeightPercentage(40);
        criteria.add(c1);
        criteria.add(c2);
        essayQuestion.setGradingCriteria(criteria);
        essayQuestion = questionRepository.save(essayQuestion);

        exam = new Exam();
        exam.setTitle("Peer review exam");
        exam.setDurationMinutes(60);
        exam.setMaxAttempts(1);
        exam.setMaxScore(BigDecimal.TEN);
        exam.setSelfReviewEnabled(true);
        exam.setPeerReviewEnabled(true);
        exam.setPeerReviewCount(2);
        exam.setPeerReviewAnonymous(true);
        exam.setPeerReviewShowReference(false);
        exam.setQuestions(Set.of(essayQuestion));
        exam = examRepository.save(exam);

        createSubmittedAttempt(studentA, 1);
        createSubmittedAttempt(studentB, 2);
        createSubmittedAttempt(studentC, 3);
    }

    private User createUser(String email, String firstName, String lastName, Role role) {
        return userRepository.findByEmail(email).orElseGet(() -> userRepository.save(User.builder()
                .email(email)
                .firstName(firstName)
                .lastName(lastName)
                .passwordHash("hashed")
                .roles(Set.of(role))
                .isActive(true)
                .isGuest(false)
                .locked(false)
                .build()));
    }

    private ExamAttempt createSubmittedAttempt(User student, int attemptNumber) {
        ExamAttempt attempt = new ExamAttempt();
        attempt.setExam(exam);
        attempt.setStudent(student);
        attempt.setAttemptNumber(attemptNumber);
        attempt.setDurationMinutes(60);
        attempt.setTotalPoints(10);
        attempt.setStartedAt(Instant.now().minusSeconds(600));
        attempt.setSubmittedAt(Instant.now().minusSeconds(60));
        attempt.setMaxScore(BigDecimal.TEN);
        attempt.setStatus(ExamAttemptStatus.SUBMITTED);

        ExamAttemptQuestion question = new ExamAttemptQuestion();
        question.setAttempt(attempt);
        question.setSourceQuestionId(essayQuestion.getId());
        question.setContent(essayQuestion.getContent());
        question.setType(QuestionType.ESSAY);
        question.setPoints(10);
        question.setDisplayOrder(1);
        question.setGuidelineReference("Reference answer text");
        question.setGuidelineRubric("Rubric text");
        List<EssayGradingCriterion> criteria = new ArrayList<>();
        for (EssayGradingCriterion source : essayQuestion.getGradingCriteria()) {
            EssayGradingCriterion copy = new EssayGradingCriterion();
            copy.setName(source.getName());
            copy.setDescription(source.getDescription());
            copy.setWeightPercentage(source.getWeightPercentage());
            criteria.add(copy);
        }
        question.setGradingCriteria(criteria);
        attempt.getQuestions().add(question);

        ExamAttemptAnswer answer = new ExamAttemptAnswer();
        answer.setAttempt(attempt);
        answer.setQuestion(question);
        answer.setTextAnswer("Answer of " + student.getFirstName());
        answer.setSaved(true);
        attempt.getAnswers().add(answer);

        return attemptRepository.save(attempt);
    }

    private UserPrincipal principal(User user, String... authorities) {
        List<SimpleGrantedAuthority> granted = new ArrayList<>();
        for (String authority : authorities) {
            granted.add(new SimpleGrantedAuthority(authority));
        }
        UserPrincipal principal = new UserPrincipal(user, granted);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
        return principal;
    }

    private ExamReviewAssignment findAssignment(ExamAttempt attempt, User reviewer, ExamReviewType type) {
        return assignmentRepository
                .findByAttempt_IdAndReviewerIdAndReviewType(attempt.getId(), reviewer.getId(), type)
                .orElseThrow(() -> new AssertionError("Assignment not found"));
    }

    @Test
    @DisplayName("P0: assign creates SELF + PEER assignments and never lets a student review their own attempt")
    void assignCreatesSelfAndPeerAssignments() {
        UserPrincipal teacherPrincipal = principal(teacher, "EXAM_REVIEW_ASSIGN", "EXAM_REVIEW_VIEW_ALL");

        ExamReviewAssignResultDTO result = peerReviewService.assignReviewers(exam.getId(), teacherPrincipal);

        assertEquals(3, result.eligibleAttemptCount());
        assertTrue(result.selfReviewEnabled());
        assertTrue(result.peerReviewEnabled());
        // 3 SELF + 3 attempts x 2 PEER = 9
        assertEquals(9, result.assignedCount());

        List<ExamReviewAssignment> all = assignmentRepository.findAllByExam_Id(exam.getId());
        assertEquals(3, all.stream().filter(a -> a.getReviewType() == ExamReviewType.SELF).count());
        assertEquals(6, all.stream().filter(a -> a.getReviewType() == ExamReviewType.PEER).count());

        for (ExamReviewAssignment assignment : all) {
            if (assignment.getReviewType() != ExamReviewType.PEER) {
                continue;
            }
            assertFalse(assignment.getAttempt().getStudent().getId().equals(assignment.getReviewerId()),
                    "A student must never review their own submission as a peer");
        }
        // Self review: reviewer is the author of the attempt.
        for (ExamReviewAssignment assignment : all) {
            if (assignment.getReviewType() != ExamReviewType.SELF) {
                continue;
            }
            assertTrue(assignment.getAttempt().getStudent().getId().equals(assignment.getReviewerId()),
                    "Self review must be assigned to the author of the attempt");
        }
    }

    @Test
    @DisplayName("P0: assign is idempotent - running it twice does not create duplicate rows")
    void assignIsIdempotent() {
        UserPrincipal teacherPrincipal = principal(teacher, "EXAM_REVIEW_ASSIGN");

        peerReviewService.assignReviewers(exam.getId(), teacherPrincipal);
        long afterFirst = assignmentRepository.findAllByExam_Id(exam.getId()).size();

        peerReviewService.assignReviewers(exam.getId(), teacherPrincipal);
        long afterSecond = assignmentRepository.findAllByExam_Id(exam.getId()).size();

        assertEquals(afterFirst, afterSecond);
        assertEquals(9, afterSecond);
    }

    @Test
    @DisplayName("P0: reviewer cannot open another reviewer's assignment")
    void reviewerCannotOpenForeignAssignment() {
        UserPrincipal teacherPrincipal = principal(teacher, "EXAM_REVIEW_ASSIGN");
        peerReviewService.assignReviewers(exam.getId(), teacherPrincipal);

        ExamAttempt attemptA = attemptRepository.findAllByExam_Id(exam.getId()).stream()
                .filter(a -> a.getStudent().getId().equals(studentA.getId()))
                .findFirst()
                .orElseThrow();
        ExamReviewAssignment assignment = findAssignment(attemptA, studentB, ExamReviewType.PEER);

        // A third party must not be able to read the assignment.
        assertThrows(Exception.class, () -> peerReviewService.getTarget(assignment.getId(), outsider.getId()));
    }

    @Test
    @DisplayName("P0: anonymous review never leaks the author identity")
    void anonymousReviewHidesAuthorIdentity() {
        UserPrincipal teacherPrincipal = principal(teacher, "EXAM_REVIEW_ASSIGN");
        peerReviewService.assignReviewers(exam.getId(), teacherPrincipal);

        ExamAttempt attemptA = attemptRepository.findAllByExam_Id(exam.getId()).stream()
                .filter(a -> a.getStudent().getId().equals(studentA.getId()))
                .findFirst()
                .orElseThrow();
        ExamReviewAssignment assignment = findAssignment(attemptA, studentB, ExamReviewType.PEER);

        principal(studentB, "EXAM_REVIEW_READ");
        ExamReviewTargetDTO target = peerReviewService.getTarget(assignment.getId(), studentB.getId());

        assertTrue(target.anonymous());
        assertEquals("Anonymous student", target.authorLabel());
        assertFalse(target.authorLabel().contains(studentA.getFirstName()));
        assertEquals(1, target.reviewableQuestionCount());
        assertEquals(2, target.questions().get(0).criteria().size());
        // Reference answer is hidden unless the exam allows it.
        assertEquals(null, target.questions().get(0).referenceAnswer());
    }

    @Test
    @DisplayName("P0: submitting a review with points above the rubric maximum is rejected with 422")
    void submitReviewRejectsPointsAboveRubricMaximum() {
        UserPrincipal teacherPrincipal = principal(teacher, "EXAM_REVIEW_ASSIGN");
        peerReviewService.assignReviewers(exam.getId(), teacherPrincipal);

        ExamAttempt attemptA = attemptRepository.findAllByExam_Id(exam.getId()).stream()
                .filter(a -> a.getStudent().getId().equals(studentA.getId()))
                .findFirst()
                .orElseThrow();
        ExamReviewAssignment assignment = findAssignment(attemptA, studentB, ExamReviewType.PEER);

        principal(studentB, "EXAM_REVIEW_CREATE");
        ExamReviewSubmitRequest request = new ExamReviewSubmitRequest(
                null,
                "too high",
                List.of(new ExamReviewSubmitRequest.Item(
                        attemptA.getQuestions().get(0).getId(), CRITERION_A,
                        new BigDecimal("99"), null)));

        assertThrows(ExamReviewValidationException.class,
                () -> peerReviewService.submitReview(assignment.getId(), studentB.getId(), request));
    }

    @Test
    @DisplayName("P1: submitting the same review twice returns a conflict")
    void submitReviewTwiceConflicts() {
        UserPrincipal teacherPrincipal = principal(teacher, "EXAM_REVIEW_ASSIGN");
        peerReviewService.assignReviewers(exam.getId(), teacherPrincipal);

        ExamAttempt attemptA = attemptRepository.findAllByExam_Id(exam.getId()).stream()
                .filter(a -> a.getStudent().getId().equals(studentA.getId()))
                .findFirst()
                .orElseThrow();
        ExamReviewAssignment assignment = findAssignment(attemptA, studentB, ExamReviewType.PEER);
        Long questionId = attemptA.getQuestions().get(0).getId();

        principal(studentB, "EXAM_REVIEW_CREATE");
        ExamReviewSubmitRequest request = new ExamReviewSubmitRequest(
                new BigDecimal("7"),
                "looks good",
                List.of(new ExamReviewSubmitRequest.Item(questionId, CRITERION_A,
                        new BigDecimal("4"), "solid")));

        ExamReviewFeedbackDTO submitted = peerReviewService.submitReview(
                assignment.getId(), studentB.getId(), request);
        assertNotNull(submitted);
        assertEquals(ExamReviewStatus.SUBMITTED, assignment.getStatus());

        assertThrows(ExamReviewConflictException.class,
                () -> peerReviewService.submitReview(assignment.getId(), studentB.getId(), request));
    }

    @Test
    @DisplayName("P0: author can only read feedback after the teacher publishes the results")
    void feedbackIsHiddenUntilResultsArePublished() {
        UserPrincipal teacherPrincipal = principal(teacher, "EXAM_REVIEW_ASSIGN");
        peerReviewService.assignReviewers(exam.getId(), teacherPrincipal);

        ExamAttempt attemptA = attemptRepository.findAllByExam_Id(exam.getId()).stream()
                .filter(a -> a.getStudent().getId().equals(studentA.getId()))
                .findFirst()
                .orElseThrow();
        ExamReviewAssignment assignment = findAssignment(attemptA, studentB, ExamReviewType.PEER);
        Long questionId = attemptA.getQuestions().get(0).getId();

        principal(studentB, "EXAM_REVIEW_CREATE");
        peerReviewService.submitReview(assignment.getId(), studentB.getId(),
                new ExamReviewSubmitRequest(
                        new BigDecimal("8"),
                        "nice",
                        List.of(new ExamReviewSubmitRequest.Item(questionId, CRITERION_A,
                                new BigDecimal("5"), "good"))));

        // Not published yet -> forbidden.
        principal(studentA, "EXAM_REVIEW_READ");
        assertThrows(ExamReviewForbiddenException.class,
                () -> peerReviewService.listFeedbackForAttempt(attemptA.getId(), studentA.getId()));

        // Publish results.
        ExamResultPublication publication = new ExamResultPublication();
        publication.setExam(exam);
        publication.setReleasePolicy(ScoreReleasePolicy.MY_SCORES_ONLY);
        publication.setPublished(true);
        publication.setPublishedAt(java.time.LocalDateTime.now());
        publicationRepository.save(publication);

        List<ExamReviewFeedbackDTO> feedback = peerReviewService.listFeedbackForAttempt(
                attemptA.getId(), studentA.getId());
        assertEquals(1, feedback.size());
        assertEquals("Anonymous reviewer", feedback.get(0).reviewerLabel());
        assertEquals(1, feedback.get(0).items().size());
    }

    @Test
    @DisplayName("P0: peer review never changes the official final score of the attempt")
    void peerReviewDoesNotChangeFinalScore() {
        UserPrincipal teacherPrincipal = principal(teacher, "EXAM_REVIEW_ASSIGN");
        peerReviewService.assignReviewers(exam.getId(), teacherPrincipal);

        ExamAttempt attemptA = attemptRepository.findAllByExam_Id(exam.getId()).stream()
                .filter(a -> a.getStudent().getId().equals(studentA.getId()))
                .findFirst()
                .orElseThrow();
        ExamReviewAssignment assignment = findAssignment(attemptA, studentB, ExamReviewType.PEER);
        Long questionId = attemptA.getQuestions().get(0).getId();

        attemptA.setFinalScore(new BigDecimal("7.5"));
        attemptRepository.save(attemptA);

        principal(studentB, "EXAM_REVIEW_CREATE");
        peerReviewService.submitReview(assignment.getId(), studentB.getId(),
                new ExamReviewSubmitRequest(
                        new BigDecimal("2"),
                        "weak",
                        List.of(new ExamReviewSubmitRequest.Item(questionId, CRITERION_A,
                                new BigDecimal("1"), "missing details"))));

        ExamAttempt reloaded = attemptRepository.findById(attemptA.getId()).orElseThrow();
        assertEquals(0, new BigDecimal("7.5").compareTo(reloaded.getFinalScore()));
    }

    @Test
    @DisplayName("P1: every assignment and submission is written to the audit log with a correlation id")
    void auditLogIsWrittenWithCorrelationId() {
        UserPrincipal teacherPrincipal = principal(teacher, "EXAM_REVIEW_ASSIGN");
        peerReviewService.assignReviewers(exam.getId(), teacherPrincipal);

        ExamAttempt attemptA = attemptRepository.findAllByExam_Id(exam.getId()).stream()
                .filter(a -> a.getStudent().getId().equals(studentA.getId()))
                .findFirst()
                .orElseThrow();
        ExamReviewAssignment assignment = findAssignment(attemptA, studentB, ExamReviewType.PEER);
        Long questionId = attemptA.getQuestions().get(0).getId();

        principal(studentB, "EXAM_REVIEW_CREATE");
        peerReviewService.submitReview(assignment.getId(), studentB.getId(),
                new ExamReviewSubmitRequest(
                        new BigDecimal("6"),
                        "ok",
                        List.of(new ExamReviewSubmitRequest.Item(questionId, CRITERION_A,
                                new BigDecimal("3"), null))));

        assertTrue(auditRepository.findAllByExamIdOrderByCreatedAtAsc(exam.getId()).stream()
                .anyMatch(log -> log.getCorrelationId() != null && !log.getCorrelationId().isBlank()));
        assertTrue(auditRepository.findAllByAssignmentIdOrderByCreatedAtAsc(assignment.getId()).stream()
                .anyMatch(log -> log.getActorId() != null));
    }

    @Test
    @DisplayName("P0: a reviewer must have submitted the exam to be eligible")
    void reviewerMustHaveSubmittedTheExam() {
        // The outsider never took the exam -> must not be assigned.
        UserPrincipal teacherPrincipal = principal(teacher, "EXAM_REVIEW_ASSIGN");
        peerReviewService.assignReviewers(exam.getId(), teacherPrincipal);

        assertTrue(assignmentRepository.findAllByExam_Id(exam.getId()).stream()
                .noneMatch(a -> a.getReviewerId().equals(outsider.getId())));
    }

    @Test
    @DisplayName("P1: the assignment list only contains the assignments owned by the current student")
    void listMyAssignmentsOnlyReturnsOwnAssignments() {
        UserPrincipal teacherPrincipal = principal(teacher, "EXAM_REVIEW_ASSIGN");
        peerReviewService.assignReviewers(exam.getId(), teacherPrincipal);

        principal(studentB, "EXAM_REVIEW_READ");
        List<ExamReviewAssignmentDTO> mine = peerReviewService.listMyAssignments(studentB.getId());

        assertFalse(mine.isEmpty());
        assertTrue(mine.stream().allMatch(a -> a.authorLabel() != null));
        // Student B reviews A and C, and self-reviews B -> 3 assignments.
        assertEquals(3, mine.size());
    }
}
