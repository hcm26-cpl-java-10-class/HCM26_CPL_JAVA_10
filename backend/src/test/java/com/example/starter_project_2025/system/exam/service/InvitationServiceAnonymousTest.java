package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.exam.domain.AnonymousSession;
import com.example.starter_project_2025.system.exam.domain.AnonymousSessionRepository;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.domain.Invitation;
import com.example.starter_project_2025.system.exam.domain.InvitationRepository;
import com.example.starter_project_2025.system.exam.domain.InvitationStatus;
import com.example.starter_project_2025.system.exam.dto.AnonymousSessionResponse;
import com.example.starter_project_2025.system.notification.service.EmailService;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Test cho luồng thi anonymous (học sinh không có tài khoản RBAC).
 *
 * <p>Trọng tâm là quy tắc "1 lượt truy cập = 1 lần bắt đầu thi thật", để học sinh
 * mở link, nhập thông tin rồi quay lại (chưa thi) không bị chặn oan.
 */
@ExtendWith(MockitoExtension.class)
class InvitationServiceAnonymousTest {

    private static final String CODE = "ABCD1234";
    private static final String EMAIL = "sv@example.com";
    private static final String NAME = "Nguyen Van A";

    @Mock
    private InvitationRepository invitationRepository;

    @Mock
    private AnonymousSessionRepository anonymousSessionRepository;

    @Mock
    private ExamRepository examRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private EmailService emailService;

    @Mock
    private GuestUserService guestUserService;

    @InjectMocks
    private InvitationService service;

    @Mock
    private RoleRepository roleRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    private Invitation invitation;
    private User guestUser;

    @BeforeEach
    void setUp() {
        guestUser = User.builder()
                .id(7L)
                .email(EMAIL)
                .isGuest(true)
                .isActive(true)
                .locked(true)
                .build();

        Exam exam = new Exam();
        exam.setId(3L);
        exam.setTitle("Kỳ thi giữa kỳ");
        exam.setDurationMinutes(30);
        exam.setIsActive(true);

        invitation = Invitation.builder()
                .id(11L)
                .exam(exam)
                .anonymous(true)
                .status(InvitationStatus.SENT)
                .accessCode(CODE)
                .token("token-abc")
                .maxAccessAttempts(1)
                .accessAttemptCount(0)
                .build();

        lenient().when(invitationRepository.lockByAccessCode(CODE)).thenReturn(Optional.of(invitation));
        lenient().when(invitationRepository.findByAccessCode(CODE)).thenReturn(Optional.of(invitation));
        lenient().when(guestUserService.findOrCreateGuest(EMAIL, NAME)).thenReturn(guestUser);
        lenient().when(anonymousSessionRepository.save(any(AnonymousSession.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        lenient().when(invitationRepository.save(any(Invitation.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    private AnonymousSession existingSession(LocalDateTime completedAt) {
        return AnonymousSession.builder()
                .id(99L)
                .invitation(invitation)
                .sessionToken("session-token-dung-la-i")
                .guestUserId(guestUser.getId())
                .guestName(NAME)
                .guestEmail(EMAIL)
                .accessedAt(LocalDateTime.now().minusMinutes(5))
                .completedAt(completedAt)
                .isValid(true)
                .build();
    }

    // ============ Tạo phiên lần đầu ============

    @Test
    @DisplayName("Nhập thông tin lần đầu thì tạo phiên mới và trừ 1 lượt truy cập")
    void firstAccessCreatesNewSessionAndConsumesAttempt() {
        when(anonymousSessionRepository.findByInvitationIdAndGuestUserIdOrderByAccessedAtDesc(11L, 7L))
                .thenReturn(List.of());

        AnonymousSessionResponse res =
                service.createAnonymousSession(CODE, null, NAME, EMAIL);

        assertTrue(res.isValid());
        assertNotNull(res.getSessionToken());
        assertEquals(1, invitation.getAccessAttemptCount());
        assertEquals(EMAIL, invitation.getGuestEmail());
        assertEquals(7L, invitation.getGuestUserId());

        ArgumentCaptor<AnonymousSession> captor = ArgumentCaptor.forClass(AnonymousSession.class);
        verify(anonymousSessionRepository).save(captor.capture());
        assertEquals(7L, captor.getValue().getGuestUserId());
    }

    // ============ Quay lại link chưa thi ============

    @Test
    @DisplayName("Quay lại link cùng email khi chưa thi thì tái dùng phiên cũ, KHÔNG trừ lượt")
    void returningStudentBeforeStartingExamReusesSession() {
        invitation.setAccessAttemptCount(1); // đã dùng hết lượt
        AnonymousSession previous = existingSession(null); // chưa nộp bài
        when(anonymousSessionRepository.findByInvitationIdAndGuestUserIdOrderByAccessedAtDesc(11L, 7L))
                .thenReturn(List.of(previous));

        AnonymousSessionResponse res =
                service.createAnonymousSession(CODE, null, NAME, EMAIL);

        // Trả lại đúng token cũ để học sinh vào được phòng thi.
        assertEquals("session-token-dung-la-i", res.getSessionToken());
        // Quan trọng: không trừ thêm lượt nào.
        assertEquals(1, invitation.getAccessAttemptCount());
        // Chỉ cập nhật lại phiên cũ, KHÔNG tạo phiên mới: token được lưu lại
        // phải là token cũ (phần assert bên dưới), và không có lần save nào
        // mang token khác.
        ArgumentCaptor<AnonymousSession> captor = ArgumentCaptor.forClass(AnonymousSession.class);
        verify(anonymousSessionRepository).save(captor.capture());
        assertEquals("session-token-dung-la-i", captor.getValue().getSessionToken());
    }

    @Test
    @DisplayName("Quay lại link cùng email nhưng đã nộp bài xong thì không tái dùng, phải hết lượt")
    void returningStudentAfterSubmitCannotReuseSession() {
        invitation.setAccessAttemptCount(1);
        // completedAt != null => phiên đã kết thúc, không tái sử dụng được.
        AnonymousSession finished = existingSession(LocalDateTime.now().minusMinutes(1));
        when(anonymousSessionRepository.findByInvitationIdAndGuestUserIdOrderByAccessedAtDesc(11L, 7L))
                .thenReturn(List.of(finished));

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.createAnonymousSession(CODE, null, NAME, EMAIL));
        assertEquals("Maximum access attempts reached for this invitation", ex.getMessage());
    }

    @Test
    @DisplayName("Phiên đã bị vô hiệu hoá (isValid=false) cũng không được tái sử dụng")
    void invalidSessionIsNotReusable() {
        invitation.setAccessAttemptCount(1);
        AnonymousSession invalidated = existingSession(null);
        invalidated.setIsValid(false);
        when(anonymousSessionRepository.findByInvitationIdAndGuestUserIdOrderByAccessedAtDesc(11L, 7L))
                .thenReturn(List.of(invalidated));

        assertThrows(BadRequestException.class,
                () -> service.createAnonymousSession(CODE, null, NAME, EMAIL));
    }

    // ============ Chặn đúng người khác ============

    @Test
    @DisplayName("Học sinh khác trên link 1 lượt thì bị chặn")
    void differentStudentBlockedWhenNoAttemptsLeft() {
        invitation.setAccessAttemptCount(1);

        // Học sinh khác -> user khách khác -> không có phiên nào để tái dùng.
        User otherGuest = User.builder()
                .id(99L)
                .email("nguoi-khac@example.com")
                .isGuest(true)
                .build();
        when(guestUserService.findOrCreateGuest(EMAIL, "Nguoi Khac")).thenReturn(otherGuest);
        when(anonymousSessionRepository
                .findByInvitationIdAndGuestUserIdOrderByAccessedAtDesc(11L, 99L))
                .thenReturn(List.of());

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.createAnonymousSession(CODE, null, "Nguoi Khac", EMAIL));
        assertEquals("Maximum access attempts reached for this invitation", ex.getMessage());
    }

    @Test
    @DisplayName("Cùng fingerprint đã truy cập thì bị chặn trùng thiết bị")
    void duplicateFingerprintBlocked() {
        when(anonymousSessionRepository.findByInvitationIdAndGuestUserIdOrderByAccessedAtDesc(11L, 7L))
                .thenReturn(List.of());
        when(anonymousSessionRepository.findByInvitationIdAndFingerprint(11L, "fp-1"))
                .thenReturn(Optional.of(existingSession(null)));

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.createAnonymousSession(CODE, "fp-1", NAME, EMAIL));
        assertEquals("This device has already accessed this exam", ex.getMessage());
    }

    // ============ Trạng thái lời mời ============

    @Test
    @DisplayName("Lời mời đã thu hồi thì không tạo được phiên")
    void revokedInvitationBlocked() {
        invitation.setStatus(InvitationStatus.REVOKED);

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.createAnonymousSession(CODE, null, NAME, EMAIL));
        assertEquals("Invitation has been revoked", ex.getMessage());
    }

    @Test
    @DisplayName("Lời mời quá hạn thì bị đánh dấu EXPIRED và từ chối")
    void expiredInvitationBlocked() {
        invitation.setExpiresAt(LocalDateTime.now().minusMinutes(1));

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.createAnonymousSession(CODE, null, NAME, EMAIL));
        assertEquals("Invitation has expired", ex.getMessage());
        assertEquals(InvitationStatus.EXPIRED, invitation.getStatus());
    }

    @Test
    @DisplayName("Quá maxAccessTime thì link đóng, không tạo được phiên")
    void pastMaxAccessTimeBlocked() {
        invitation.setMaxAccessTime(LocalDateTime.now().minusMinutes(1));

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.createAnonymousSession(CODE, null, NAME, EMAIL));
        assertEquals("Access window for this invitation has closed", ex.getMessage());
        assertEquals(InvitationStatus.EXPIRED, invitation.getStatus());
    }

    @Test
    @DisplayName("Mã truy cập không tồn tại thì báo lỗi")
    void unknownAccessCodeRejected() {
        when(invitationRepository.lockByAccessCode("NOPE0000")).thenReturn(Optional.empty());

        assertThrows(Exception.class,
                () -> service.createAnonymousSession("NOPE0000", null, NAME, EMAIL));
    }

    // ============ Không gắn bài thi vào tài khoản thật ============

    @Test
    @DisplayName("Email thuộc tài khoản RBAC thật thì tạo user khách riêng, không dùng user thật")
    void realAccountEmailGetsSeparateGuestUser() {
        // GuestUserService phải KHÔNG trả về tài khoản thật cho endpoint public.
        GuestUserService realService = new GuestUserService(userRepository, roleRepository, passwordEncoder);

        User realUser = User.builder().id(42L).email(EMAIL).isGuest(false).isActive(true).build();
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(realUser));
        when(userRepository.existsByEmail(any())).thenReturn(false);
        when(roleRepository.findByName("STUDENT"))
                .thenReturn(Optional.of(Role.builder().name("STUDENT").build()));
        when(passwordEncoder.encode(any())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(500L);
            return u;
        });

        User result = realService.findOrCreateGuest(EMAIL, NAME);

        assertNotNull(result);
        assertTrue(Boolean.TRUE.equals(result.getIsGuest()), "user trả về phải là guest");
        assertEquals(500L, result.getId(), "phải tạo user khách MỚI, không dùng user thật");
        // Email nội bộ để không đụng vào tài khoản thật.
        assertTrue(result.getEmail().endsWith("@anon.invalid"),
                "email nội bộ phải dùng miền .invalid, thực tế: " + result.getEmail());
        assertTrue(result.getLocked(), "user khách phải bị khoá, không đăng nhập được");
    }

    @Test
    @DisplayName("Email đã có user khách thì tái dùng user đó, không tạo trùng")
    void existingGuestUserIsReused() {
        GuestUserService realService = new GuestUserService(userRepository, roleRepository, passwordEncoder);

        User existingGuest = User.builder().id(88L).email(EMAIL).isGuest(true).build();
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(existingGuest));

        User result = realService.findOrCreateGuest(EMAIL, NAME);

        assertEquals(88L, result.getId());
        verify(userRepository, never()).save(any(User.class));
    }

    // ============ verifyAccessCode ============

    @Test
    @DisplayName("verifyAccessCode trả về số lượt còn lại")
    void verifyReportsRemainingAttempts() {
        var res = service.verifyAccessCode(CODE);

        assertTrue(res.isValid());
        assertEquals(1, res.getAccessAttemptsRemaining());
        assertEquals("Kỳ thi giữa kỳ", res.getExamTitle());
    }

    @Test
    @DisplayName("verifyAccessCode đánh dấu EXPIRED khi quá maxAccessTime")
    void verifyMarksExpiredPastMaxAccessTime() {
        invitation.setMaxAccessTime(LocalDateTime.now().minusMinutes(1));

        var res = service.verifyAccessCode(CODE);

        assertFalse(res.isValid());
        assertEquals("The access window for this link has closed", res.getMessage());
        assertEquals(InvitationStatus.EXPIRED, invitation.getStatus());
    }
}