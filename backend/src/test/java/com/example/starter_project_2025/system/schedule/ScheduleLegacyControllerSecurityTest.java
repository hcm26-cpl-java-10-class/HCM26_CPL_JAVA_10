package com.example.starter_project_2025.system.schedule;

import com.example.starter_project_2025.system.schedule_validation.ScheduleValidationController;
import com.example.starter_project_2025.system.schedule_validation.ScheduleValidationRequest;
import com.example.starter_project_2025.system.schedule_validation.ScheduleValidationResult;
import com.example.starter_project_2025.system.schedule_validation.ScheduleValidationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authorization.method.AuthorizationManagerBeforeMethodInterceptor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ScheduleLegacyControllerSecurityTest {
    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
    }

    static Stream<Arguments> permissionCombinations() {
        return Stream.of(
                Arguments.of(new String[]{}, false),
                Arguments.of(new String[]{"SESSION_READ"}, false),
                Arguments.of(new String[]{"SESSION_CREATE"}, false),
                Arguments.of(new String[]{"SESSION_UPDATE"}, false),
                Arguments.of(new String[]{"SESSION_CREATE", "SESSION_UPDATE"}, false),
                Arguments.of(new String[]{"SESSION_READ", "SESSION_CREATE"}, true),
                Arguments.of(new String[]{"SESSION_READ", "SESSION_UPDATE"}, true),
                Arguments.of(new String[]{"SESSION_READ", "SESSION_CREATE", "SESSION_UPDATE"}, true));
    }

    @ParameterizedTest
    @MethodSource("permissionCombinations")
    void previewRequiresReadAndWriteAccess(String[] permissions, boolean allowed) {
        var service = mock(ScheduleValidationService.class);
        var target = new ScheduleValidationController(service);
        var factory = new ProxyFactory(target);
        factory.setProxyTargetClass(true);
        factory.addAdvisor(AuthorizationManagerBeforeMethodInterceptor.preAuthorize());
        var secured = (ScheduleValidationController) factory.getProxy();

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("scheduler", "",
                        Arrays.stream(permissions).map(SimpleGrantedAuthority::new).toList()));
        var request = new ScheduleValidationRequest();
        request.setSessions(List.of());
        var result = ScheduleValidationResult.from(List.of());
        when(service.validateBatch(request.getSessions())).thenReturn(result);

        if (allowed) {
            assertSame(result, secured.validate(request).getBody());
            verify(service).validateBatch(request.getSessions());
        } else {
            assertThrows(AccessDeniedException.class, () -> secured.validate(request));
            verifyNoInteractions(service);
        }
    }
}
