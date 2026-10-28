package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.domain.AnonymousSession;
import com.example.starter_project_2025.system.exam.domain.AnonymousSessionRepository;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.exam.domain.Invitation;
import com.example.starter_project_2025.system.exam.dto.ExamAttemptDTO;
import com.example.starter_project_2025.system.exam.dto.SaveExamAnswerRequest;
import com.example.starter_project_2025.system.notification.service.EmailService;
import com.example.starter_project_2025.system.rbac.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AnonymousExamServiceTest {

    private static final String TOKEN = "session-token-hop-le";
    private static final Long ATTEMPT_ID = 55L;
    private static final Long EXAM_ID = 3L;
    private static final Long GUEST_ID = 7L;

    @Mock
    private AnonymousSessionRepository sessionRepository;

    @Mock
    private ExamAttemptService attemptService;

    @Mock
    private ExamAttemptRepository attemptRepository;

    @Mock
    private EmailService emailService;

    @InjectMocks
    private AnonymousExamService service;

    private AnonymousSession session;
    private ExamAttempt attempt;

    @BeforeEach
    void setUp() {
        Exam exam = new Exam();
        exam.setId(EXAM_ID);
        exam.setTitle("Kỳ thi giữa kỳ");

        Invitation invitation = Invitation.builder()
                .id(11L)
                .exam(exam)
                .anonymous(true)
                .accessCode("ABCD1234")
                .build();

        session = AnonymousSession.builder()
                .id(99L)
                .invitation(invitation)
                .sessionToken(TOKEN)
                .guestUserId(GUEST_ID)
                .guestName("Nguyen Van A")
                .guestEmail("sv@example.com")
                .accessedAt(LocalDateTime.now().minusMinutes(5))
                .isValid(true)
                .build();

        User student = User.builder()
                .id(GUEST_ID)
                .email("sv@example.com")
                .firstName("Nguyen Van A")
                .isGuest(true)
                .build();

        attempt = new ExamAttempt();
        attempt.setId(ATTEMPT_ID);
        attempt.setExam(exam);
        attempt.setStudent(student);
        attempt.setStatus(ExamAttemptStatus.SUBMITTED);
        attempt.setObjectiveScore(new BigDecimal(7));
        attempt.setFinalScore(new BigDecimal(7));
        attempt.setTotalPoints(10);
        attempt.setSubmittedAt(Instant.now().minusSeconds(60));
    }

    private void givenValidSession() {
        lenient().when(sessionRepository.findBySessionToken(TOKEN)).thenReturn(Optional.of(session));
    }

    @Test
    @DisplayName("Token rỗng thì bị từ chối, không gọi xuống tầng dưới")
    void blankTokenRejected() {
        assertThrows(BadRequestException.class, () -> service.startOrResume("   ", null));
        verify(attemptService, never()).startOrResumeForGuest(any(), any(), any());
    }

    @Test
    @DisplayName("Token không tồn tại thì bị từ chối")
    void unknownTokenRejected() {
        when(sessionRepository.findBySessionToken("sai")).thenReturn(Optional.empty());

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.startOrResume("sai", null));
        assertTrue(ex.getMessage().contains("Phiên thi không hợp lệ"));
    }

    @Test
    @DisplayName("Phiên đã bị vô hiệu hoá (đã nộp bài) thì không mở được bài thi nữa")
    void invalidSessionRejected() {
        session.setIsValid(false);
        givenValidSession();

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.startOrResume(TOKEN, null));
        assertTrue(ex.getMessage().contains("đã hết hạn"));
    }

    @Test
    @DisplayName("Phiên hợp lệ thì mở bài thi bằng đúng exam và guest user của phiên")
    void validSessionStartsAttempt() {
        givenValidSession();
        ExamAttemptDTO dto = new ExamAttemptDTO();
        dto.setId(ATTEMPT_ID);
        when(attemptService.startOrResumeForGuest(EXAM_ID, GUEST_ID, null)).thenReturn(dto);

        ExamAttemptDTO result = service.startOrResume(TOKEN, null);

        assertNotNull(result);
        verify(attemptService).startOrResumeForGuest(EXAM_ID, GUEST_ID, null);
    }

    @Test
    @DisplayName("Lưu đáp án cho bài thi của học sinh khác thì bị chặn")
    void cannotSaveAnswersOfAnotherStudentAttempt() {
        givenValidSession();
        User otherStudent = User.builder().id(999L).email("khac@example.com").isGuest(true).build();
        attempt.setStudent(otherStudent);
        when(attemptRepository.findById(ATTEMPT_ID)).thenReturn(Optional.of(attempt));

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.saveAnswers(TOKEN, ATTEMPT_ID, List.of()));
        assertEquals("Bài thi không thuộc phiên của bạn", ex.getMessage());
        verify(attemptService, never()).saveAnswers(any(), any(), any());
    }

    @Test
    @DisplayName("Bài thi của đề khác thì bị chặn dù đúng học sinh")
    void cannotTouchAttemptOfAnotherExam() {
        givenValidSession();
        Exam otherExam = new Exam();
        otherExam.setId(999L);
        otherExam.setTitle("Đề khác");
        attempt.setExam(otherExam);
        when(attemptRepository.findById(ATTEMPT_ID)).thenReturn(Optional.of(attempt));

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.saveAnswers(TOKEN, ATTEMPT_ID, List.of()));
        assertEquals("Bài thi không thuộc phiên của bạn", ex.getMessage());
    }

    @Test
    @DisplayName("Attempt không tồn tại thì báo 404")
    void missingAttemptThrowsNotFound() {
        givenValidSession();
        when(attemptRepository.findById(404L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> service.saveAnswers(TOKEN, 404L, List.of()));
    }

    @Test
    @DisplayName("Bài thi đúng của phiên thì lưu đáp án được")
    void canSaveOwnAnswers() {
        givenValidSession();
        when(attemptRepository.findById(ATTEMPT_ID)).thenReturn(Optional.of(attempt));
        List<SaveExamAnswerRequest> answers = List.of(new SaveExamAnswerRequest());
        ExamAttemptDTO dto = new ExamAttemptDTO();
        dto.setId(ATTEMPT_ID);
        when(attemptService.saveAnswers(ATTEMPT_ID, GUEST_ID, answers)).thenReturn(dto);

        assertNotNull(service.saveAnswers(TOKEN, ATTEMPT_ID, answers));
        verify(attemptService).saveAnswers(ATTEMPT_ID, GUEST_ID, answers);
    }

    @Test
    @DisplayName("Nộp bài xong thì gửi email kết quả và vô hiệu hoá phiên")
    void submitSendsResultEmailAndInvalidatesSession() {
        givenValidSession();
        when(attemptRepository.findById(ATTEMPT_ID)).thenReturn(Optional.of(attempt));
        ExamAttemptDTO dto = new ExamAttemptDTO();
        dto.setId(ATTEMPT_ID);
        dto.setStatus(ExamAttemptStatus.SUBMITTED);
        when(attemptService.submit(ATTEMPT_ID, GUEST_ID, List.of())).thenReturn(dto);
        lenient().when(sessionRepository.save(any(AnonymousSession.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        service.submit(TOKEN, ATTEMPT_ID, List.of());

        verify(emailService, times(1)).sendAnonymousExamResult(
                eq("sv@example.com"),
                eq("Nguyen Van A"),
                eq("Kỳ thi giữa kỳ"),
                eq(new BigDecimal(7)),
                eq(BigDecimal.TEN),
                anyString(),
                eq(false)
        );
        verify(sessionRepository).save(session);
        assertNotNull(session.getCompletedAt());
        assertEquals(false, session.getIsValid());
    }

    @Test
    @DisplayName("Submit lần thứ hai bị từ chối và không gửi lại email")
    void submitTwiceSendsEmailOnlyOnce() {
        givenValidSession();
        when(attemptRepository.findById(ATTEMPT_ID)).thenReturn(Optional.of(attempt));
        ExamAttemptDTO dto = new ExamAttemptDTO();
        dto.setId(ATTEMPT_ID);
        dto.setStatus(ExamAttemptStatus.SUBMITTED);
        when(attemptService.submit(eq(ATTEMPT_ID), eq(GUEST_ID), any())).thenReturn(dto);
        lenient().when(sessionRepository.save(any(AnonymousSession.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        service.submit(TOKEN, ATTEMPT_ID, List.of());

        assertThrows(BadRequestException.class, () -> service.submit(TOKEN, ATTEMPT_ID, List.of()));

        verify(emailService, times(1)).sendAnonymousExamResult(
                anyString(), anyString(), anyString(), any(), any(), anyString(), anyBoolean());
        verify(attemptService, times(1)).submit(eq(ATTEMPT_ID), eq(GUEST_ID), any());
    }

    @Test
    @DisplayName("Bài đang làm (IN_PROGRESS) thì không gửi email")
    void doesNotSendEmailWhenNotFinished() {
        givenValidSession();
        attempt.setStatus(ExamAttemptStatus.IN_PROGRESS);
        when(attemptRepository.findById(ATTEMPT_ID)).thenReturn(Optional.of(attempt));
        ExamAttemptDTO dto = new ExamAttemptDTO();
        dto.setId(ATTEMPT_ID);
        dto.setStatus(ExamAttemptStatus.IN_PROGRESS);
        when(attemptService.submit(eq(ATTEMPT_ID), eq(GUEST_ID), any())).thenReturn(dto);

        service.submit(TOKEN, ATTEMPT_ID, List.of());

        verify(emailService, never()).sendAnonymousExamResult(
                any(), any(), any(), any(), any(), any(), anyBoolean());
        assertEquals(null, session.getCompletedAt());
    }

    @Test
    @DisplayName("Có câu tự luận thì báo đang chờ chấm, lấy điểm trắc nghiệm")
    void essayPendingUsesObjectiveScore() {
        givenValidSession();
        attempt.setFinalScore(null);
        attempt.setObjectiveScore(new BigDecimal(6));
        attempt.setStatus(ExamAttemptStatus.PENDING_REVIEW);
        when(attemptRepository.findById(ATTEMPT_ID)).thenReturn(Optional.of(attempt));
        ExamAttemptDTO dto = new ExamAttemptDTO();
        dto.setId(ATTEMPT_ID);
        dto.setStatus(ExamAttemptStatus.PENDING_REVIEW);
        when(attemptService.submit(eq(ATTEMPT_ID), eq(GUEST_ID), any())).thenReturn(dto);
        lenient().when(sessionRepository.save(any(AnonymousSession.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        service.submit(TOKEN, ATTEMPT_ID, List.of());

        verify(emailService, times(1)).sendAnonymousExamResult(
                eq("sv@example.com"), anyString(), anyString(), eq(new BigDecimal(6)), eq(BigDecimal.TEN), anyString(), eq(true));
    }

    @Test
    @DisplayName("Lỗi gửi email KHÔNG được làm fail request nộp bài")
    void emailFailureDoesNotBreakSubmit() {
        givenValidSession();
        when(attemptRepository.findById(ATTEMPT_ID)).thenReturn(Optional.of(attempt));
        ExamAttemptDTO dto = new ExamAttemptDTO();
        dto.setId(ATTEMPT_ID);
        dto.setStatus(ExamAttemptStatus.SUBMITTED);
        when(attemptService.submit(eq(ATTEMPT_ID), eq(GUEST_ID), any())).thenReturn(dto);
        lenient().when(sessionRepository.save(any(AnonymousSession.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        doThrow(new RuntimeException("SMTP auth failed"))
                .when(emailService).sendAnonymousExamResult(any(), any(), any(),
                        any(), any(), any(), anyBoolean());

        ExamAttemptDTO result = assertDoesNotThrow(() -> service.submit(TOKEN, ATTEMPT_ID, List.of()));

        assertNotNull(result);
        assertEquals(ATTEMPT_ID, result.getId());
    }

    @Test
    @DisplayName("Gửi kết quả cuối cho học sinh anonymous sau khi chấm")
    void sendsFinalResultToGuest() {
        when(attemptRepository.findById(ATTEMPT_ID)).thenReturn(Optional.of(attempt));
        attempt.setFinalScore(new BigDecimal(9));

        service.sendFinalResultToGuest(ATTEMPT_ID);

        verify(emailService, times(1)).sendAnonymousExamResult(
                eq("sv@example.com"),
                eq("Nguyen Van A"),
                eq("Kỳ thi giữa kỳ"),
                eq(new BigDecimal(9)),
                eq(BigDecimal.TEN),
                anyString(),
                eq(false)
        );
    }

    @Test
    @DisplayName("Bài thi của tài khoản thật thì không gửi email kiểu anonymous")
    void doesNotSendFinalResultToRealAccount() {
        attempt.getStudent().setIsGuest(false);
        attempt.setFinalScore(new BigDecimal(9));
        when(attemptRepository.findById(ATTEMPT_ID)).thenReturn(Optional.of(attempt));

        service.sendFinalResultToGuest(ATTEMPT_ID);

        verify(emailService, never()).sendAnonymousExamResult(
                any(), any(), any(), any(), any(), any(), anyBoolean());
    }

    @Test
    @DisplayName("Bài chưa có điểm cuối cùng thì không gửi email bổ sung")
    void doesNotSendFinalResultWithoutScore() {
        attempt.setFinalScore(null);
        when(attemptRepository.findById(ATTEMPT_ID)).thenReturn(Optional.of(attempt));

        service.sendFinalResultToGuest(ATTEMPT_ID);

        verify(emailService, never()).sendAnonymousExamResult(
                any(), any(), any(), any(), any(), any(), anyBoolean());
    }
}