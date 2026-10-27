package com.example.starter_project_2025.system.project.alert;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.task.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.core.Ordered;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.dao.*;
import jakarta.persistence.*;
import java.util.*;
@Slf4j @RestControllerAdvice(assignableTypes=ProjectAlertController.class) @Order(Ordered.HIGHEST_PRECEDENCE)
public class ProjectAlertErrors {
    private ResponseEntity<Map<String,Object>> response(int status,String message,Map<String,?> extra) {
        String id=TaskRequestContext.currentCorrelationId();Map<String,Object> body=new LinkedHashMap<>(extra);
        body.put("status",status);body.put("message",message);body.put("correlationId",id);
        return ResponseEntity.status(status).header("X-Correlation-ID",id).body(body);
    }
    @ExceptionHandler(ProjectAlertCooldownException.class) public ResponseEntity<?> cooldown(ProjectAlertCooldownException e) {
        return response(422,"These members were reminded recently. Please try again later.",Map.of("errors",e.getErrors(),"cooldownMembers",e.getMembers()));
    }
    @ExceptionHandler(TaskValidationException.class) public ResponseEntity<?> validation(TaskValidationException e) {return response(422,"Please check the highlighted fields",Map.of("errors",e.getErrors()));}
    @ExceptionHandler(TaskConflictException.class) public ResponseEntity<?> conflict(TaskConflictException e) {return response(409,e.getMessage(),Map.of());}
    @ExceptionHandler(ResourceNotFoundException.class) public ResponseEntity<?> missing(ResourceNotFoundException e) {return response(404,e.getMessage(),Map.of());}
    @ExceptionHandler(AccessDeniedException.class) public ResponseEntity<?> denied(AccessDeniedException e) {return response(403,e.getMessage(),Map.of());}
    @ExceptionHandler(AuthenticationCredentialsNotFoundException.class) public ResponseEntity<?> login(AuthenticationCredentialsNotFoundException e) {return response(401,e.getMessage(),Map.of());}
    @ExceptionHandler({HttpMessageNotReadableException.class,MethodArgumentTypeMismatchException.class,org.springframework.validation.BindException.class})
    public ResponseEntity<?> invalid(Exception e) {return response(422,"Invalid alert request or filters",Map.of());}
    @ExceptionHandler({OptimisticLockException.class,PessimisticLockException.class,LockTimeoutException.class,
            OptimisticLockingFailureException.class,PessimisticLockingFailureException.class,DataIntegrityViolationException.class})
    public ResponseEntity<?> changed(Exception e) {return response(409,"Data changed while the alert was being prepared. Reload the list.",Map.of());}
    @ExceptionHandler(Exception.class) public ResponseEntity<?> failed(Exception e) {
        log.error("Project alert request failed, correlationId={}",TaskRequestContext.currentCorrelationId(),e);
        return response(500,"Unable to load or queue alerts. Please try again.",Map.of());
    }
}
