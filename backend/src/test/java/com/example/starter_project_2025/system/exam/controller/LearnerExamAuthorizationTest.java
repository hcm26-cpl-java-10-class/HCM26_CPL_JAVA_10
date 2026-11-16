package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.exam.service.*;
import org.junit.jupiter.api.*;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.data.domain.PageRequest;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class LearnerExamAuthorizationTest {
    @Configuration @EnableMethodSecurity static class Config {
        @Bean com.example.starter_project_2025.base.crud.spec.AutoSpecBuilder specs(){return new com.example.starter_project_2025.base.crud.spec.AutoSpecBuilder();}
        @Bean ExamServiceImpl exams(){return mock(ExamServiceImpl.class);}
        @Bean ExamAttemptService attempts(){return mock(ExamAttemptService.class);}
        @Bean ExamExportService exports(){return mock(ExamExportService.class);}
        @Bean ExamQuestionPoolVersionService pools(){return mock(ExamQuestionPoolVersionService.class);}
        @Bean ExamController management(ExamServiceImpl s){return new ExamController(s);}
        @Bean ExamAttemptController learner(ExamAttemptService s){return new ExamAttemptController(s);}
        @Bean ExamExportController exportController(ExamExportService s){return new ExamExportController(s);}
        @Bean ExamQuestionPoolVersionController poolController(ExamQuestionPoolVersionService s){return new ExamQuestionPoolVersionController(s);}
    }
    AnnotationConfigApplicationContext context=new AnnotationConfigApplicationContext(Config.class);
    @AfterEach void close(){SecurityContextHolder.clearContext();context.close();}
    UserPrincipal authenticate(String...authorities) {
        var p=new UserPrincipal(User.builder().id(7L).build(),Arrays.stream(authorities).map(SimpleGrantedAuthority::new).toList());
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(p,"",p.getAuthorities()));return p;
    }
    @Test void studentReadGrantDoesNotAuthorizeManagementListDetailExportOrQuestionPool() {
        authenticate("ROLE_STUDENT","EXAM_READ","EXAM_TAKE","EXAM_UPDATE","EXAM_CREATE","EXAM_DELETE");
        var c=context.getBean(ExamController.class);
        assertThrows(AccessDeniedException.class,()->c.getAll(PageRequest.of(0,10),null,null));
        assertThrows(AccessDeniedException.class,()->c.getById(1L));
        assertThrows(AccessDeniedException.class,()->c.create(null));
        assertThrows(AccessDeniedException.class,()->c.update(1L,null));
        assertThrows(AccessDeniedException.class,()->c.delete(1L));
        assertThrows(AccessDeniedException.class,()->context.getBean(ExamExportController.class).exportExcel(null,null));
        assertThrows(AccessDeniedException.class,()->context.getBean(ExamQuestionPoolVersionController.class).getCurrentConfig(1L));
        verifyNoInteractions(context.getBean(ExamServiceImpl.class));
    }
    @Test void learnerOverviewUsesAuthenticatedIdentityAndDoesNotStart() {
        var p=authenticate("ROLE_STUDENT","EXAM_TAKE");context.getBean(ExamAttemptController.class).preparation(1L,p);
        verify(context.getBean(ExamAttemptService.class)).preparation(1L,7L);
        verify(context.getBean(ExamAttemptService.class),never()).startOrResume(any(),any(),any());
    }
    @Test void adminStudentPreviewDoesNotReplaceBackendIdentity() {
        var p=authenticate("ROLE_ADMIN","EXAM_TAKE");context.getBean(ExamAttemptController.class).preparation(1L,p);
        verify(context.getBean(ExamAttemptService.class)).preparation(1L,7L);
        context.getBean(ExamController.class).getById(1L);verify(context.getBean(ExamServiceImpl.class)).getById(1L);
    }
}
