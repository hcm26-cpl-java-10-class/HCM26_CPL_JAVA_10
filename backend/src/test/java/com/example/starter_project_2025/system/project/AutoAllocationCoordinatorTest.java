package com.example.starter_project_2025.system.project;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.rbac.user.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

class AutoAllocationCoordinatorTest {
    private static final Long CLASS_ID = 10L;
    private static final Long SESSION_ID = 20L;
    private static final Long ACTOR_ID = 1L;
    private static final String OPERATION = "AUTO_ALLOCATION_CONFIRM";

    private AutoAllocationService service;
    private IdempotencyStore idempotency;
    private AutoAllocationCoordinator coordinator;
    private final ObjectMapper mapper = new ObjectMapper();
    private final AutoAllocationConfirmRequest request = new AutoAllocationConfirmRequest("fp",
            List.of(new AutoAllocationConfirmRequest.Team("Nhóm 1", List.of(1L, 2L))));

    @BeforeEach
    void setUp() {
        service = mock(AutoAllocationService.class);
        idempotency = mock(IdempotencyStore.class);
        coordinator = new AutoAllocationCoordinator(service, idempotency, mapper);
    }

    @Test
    void rejectsMissingBlankOrOversizedKeyBeforeTouchingTheStore() {
        for (String key : new String[] {null, "", "   ", "k".repeat(129)}) {
            AutoAllocationException error = assertThrows(AutoAllocationException.class,
                    () -> coordinator.confirm(CLASS_ID, SESSION_ID, key, request, actor()));
            assertEquals(HttpStatus.BAD_REQUEST, error.getStatus());
            assertEquals("ERR_INVALID_IDEMPOTENCY_KEY", error.getCode());
        }
        verifyNoInteractions(idempotency, service);
    }

    @Test
    void newClaimRunsTheServiceAndStoresTheResponse() {
        when(idempotency.claim(eq(ACTOR_ID), eq(OPERATION), eq("key"), anyString()))
                .thenAnswer(invocation -> processing(invocation.getArgument(3)));
        when(service.confirm(eq(CLASS_ID), eq(SESSION_ID), eq(request), any())).thenReturn(response());

        ResponseEntity<String> result = coordinator.confirm(CLASS_ID, SESSION_ID, "key", request, actor());

        assertEquals(HttpStatus.CREATED, result.getStatusCode());
        verify(idempotency).complete(eq(99L), eq(201), eq(result.getBody()));
        verify(idempotency, never()).releaseForRetry(any());
    }

    @Test
    void completedReplayReturnsTheStoredBodyWithoutRunningTheServiceAgain() {
        when(idempotency.claim(eq(ACTOR_ID), eq(OPERATION), eq("key"), anyString()))
                .thenAnswer(invocation -> completed(invocation.getArgument(3), "{\"cached\":true}"));

        ResponseEntity<String> result = coordinator.confirm(CLASS_ID, SESSION_ID, "key", request, actor());

        assertEquals(HttpStatus.CREATED, result.getStatusCode());
        assertEquals("{\"cached\":true}", result.getBody());
        verifyNoInteractions(service);
    }

    @Test
    void sameKeyWithADifferentBodyIsAConflict() {
        when(idempotency.claim(eq(ACTOR_ID), eq(OPERATION), eq("key"), anyString()))
                .thenReturn(completed("another-request-hash", "{}"));

        assertThrows(IdempotencyKeyConflictException.class,
                () -> coordinator.confirm(CLASS_ID, SESSION_ID, "key", request, actor()));
        verifyNoInteractions(service);
    }

    @Test
    void concurrentClaimStillProcessingIsReportedAsInProgress() {
        String[] hash = new String[1];
        when(idempotency.claim(eq(ACTOR_ID), eq(OPERATION), eq("key"), anyString()))
                .thenAnswer(invocation -> {
                    hash[0] = invocation.getArgument(3);
                    throw new DataIntegrityViolationException("duplicate key");
                });
        when(idempotency.find(ACTOR_ID, OPERATION, "key")).thenAnswer(invocation -> processing(hash[0]));

        assertThrows(IdempotencyRequestInProgressException.class,
                () -> coordinator.confirm(CLASS_ID, SESSION_ID, "key", request, actor()));
        verifyNoInteractions(service);
    }

    @Test
    void concurrentClaimThatAlreadyCompletedReplaysTheStoredResponse() {
        String[] hash = new String[1];
        when(idempotency.claim(eq(ACTOR_ID), eq(OPERATION), eq("key"), anyString()))
                .thenAnswer(invocation -> {
                    hash[0] = invocation.getArgument(3);
                    throw new DataIntegrityViolationException("duplicate key");
                });
        when(idempotency.find(ACTOR_ID, OPERATION, "key"))
                .thenAnswer(invocation -> completed(hash[0], "{\"cached\":true}"));

        ResponseEntity<String> result = coordinator.confirm(CLASS_ID, SESSION_ID, "key", request, actor());

        assertEquals("{\"cached\":true}", result.getBody());
        verifyNoInteractions(service);
    }

    @Test
    void serviceFailureReleasesTheKeySoTheClientCanRetry() {
        when(idempotency.claim(eq(ACTOR_ID), eq(OPERATION), eq("key"), anyString()))
                .thenAnswer(invocation -> processing(invocation.getArgument(3)));
        AutoAllocationException stale = new AutoAllocationException(HttpStatus.CONFLICT,
                "ERR_AUTO_ALLOCATION_STALE", "stale");
        when(service.confirm(eq(CLASS_ID), eq(SESSION_ID), eq(request), any())).thenThrow(stale);

        AutoAllocationException thrown = assertThrows(AutoAllocationException.class,
                () -> coordinator.confirm(CLASS_ID, SESSION_ID, "key", request, actor()));

        assertSame(stale, thrown);
        verify(idempotency).releaseForRetry(99L);
        verify(idempotency, never()).complete(any(), anyInt(), any());
    }

    private static IdempotencyRecord processing(String hash) {
        return IdempotencyRecord.builder().id(99L).actorId(ACTOR_ID).operation(OPERATION)
                .idempotencyKey("key").requestHash(hash).status(IdempotencyStatus.PROCESSING).build();
    }

    private static IdempotencyRecord completed(String hash, String body) {
        return IdempotencyRecord.builder().id(99L).actorId(ACTOR_ID).operation(OPERATION)
                .idempotencyKey("key").requestHash(hash).status(IdempotencyStatus.COMPLETED)
                .httpStatus(201).responseBody(body).build();
    }

    private static BatchSaveDraftResponse response() {
        return new BatchSaveDraftResponse("SUCCESS", SESSION_ID, List.of(), List.of());
    }

    private static Authentication actor() {
        User user = User.builder().id(ACTOR_ID).email("manager@example.com")
                .passwordHash("test").firstName("Manager").build();
        return new UsernamePasswordAuthenticationToken(new UserPrincipal(user, List.of()), null, List.of());
    }
}
