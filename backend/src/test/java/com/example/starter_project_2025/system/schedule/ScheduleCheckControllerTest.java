package com.example.starter_project_2025.system.schedule;

import org.junit.jupiter.api.*;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authorization.method.AuthorizationManagerBeforeMethodInterceptor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.http.MediaType;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

class ScheduleCheckControllerTest {
    private static void authenticate(String... permissions) {
        SecurityContextHolder.getContext().setAuthentication(
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken("scheduler", "",
                        Arrays.stream(permissions).map(org.springframework.security.core.authority.SimpleGrantedAuthority::new).toList()));
    }
    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); }

    @Test void methodSecurityProtectsResourcesAndPreview() {
        var target=new ScheduleCheckController(mock(ScheduleValidationEngine.class),new DemoScheduleReferenceProvider(),new ScheduleRules());
        ProxyFactory factory=new ProxyFactory(target);
        factory.setProxyTargetClass(true);
        factory.addAdvisor(AuthorizationManagerBeforeMethodInterceptor.preAuthorize());
        var secured=(ScheduleCheckController)factory.getProxy();
        authenticate("SESSION_READ");
        assertThrows(AccessDeniedException.class,secured::resources);
        authenticate("SESSION_READ","SESSION_CREATE");
        assertNotNull(secured.resources());
    }
    @Test void rejectsEmptyMalformedPayloadAndReturnsStructuredIssues() throws Exception {
        var service=mock(ScheduleValidationEngine.class);
        var result=new ScheduleValidationResult(false,"Asia/Ho_Chi_Minh",List.of(new ScheduleIssue("ROOM_CONFLICT","roomId","The room is already booked for another session during this time.",0,null,42L,"Java",null,null)));
        when(service.validate(anyList())).thenReturn(result);
        MockMvc mvc=MockMvcBuilders.standaloneSetup(new ScheduleCheckController(service,new DemoScheduleReferenceProvider(),new ScheduleRules()))
                .setControllerAdvice(new ScheduleExceptionHandler()).build();
        mvc.perform(post("/api/schedule-checks").contentType(MediaType.APPLICATION_JSON).content("{\"sessions\":[]}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/schedule-checks").contentType(MediaType.APPLICATION_JSON).content("{\"sessions\":[{\"startTime\":\"not-a-date\"}]}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/schedule-checks").contentType(MediaType.APPLICATION_JSON).content("{\"sessions\":[{\"title\":\"Java\"}]}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.valid").value(false))
                .andExpect(jsonPath("$.issues[0].relatedSessionId").value(42));
    }
}
