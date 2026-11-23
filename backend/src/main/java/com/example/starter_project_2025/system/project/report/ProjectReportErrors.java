package com.example.starter_project_2025.system.project.report;

import com.example.starter_project_2025.system.project.task.TaskRequestContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;
import java.util.Map;

@Slf4j @Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes=ProjectReportController.class)
public class ProjectReportErrors {
    @ExceptionHandler(ResponseStatusException.class) public ResponseEntity<?> status(ResponseStatusException error){return response(error.getStatusCode().value(),error.getReason());}
    @ExceptionHandler(AccessDeniedException.class) public ResponseEntity<?> denied(AccessDeniedException error){return response(403,error.getMessage());}
    @ExceptionHandler(AuthenticationCredentialsNotFoundException.class) public ResponseEntity<?> login(Exception error){return response(401,"Your session is invalid");}
    @ExceptionHandler({org.springframework.validation.BindException.class,org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class,
            org.springframework.http.converter.HttpMessageNotReadableException.class})
    public ResponseEntity<?> invalid(Exception error){return response(422,"The report filters or export request are invalid");}
    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class) public ResponseEntity<?> conflict(Exception error){return response(409,"The request has changed. Retry with the same request key.");}
    @ExceptionHandler(Exception.class) public ResponseEntity<?> failed(Exception error){log.error("Project report failed",error);return response(500,"Could not load the report. Try again.");}
    private ResponseEntity<?> response(int status,String message){String id=TaskRequestContext.currentCorrelationId();return ResponseEntity.status(status).header("X-Correlation-ID",id)
            .body(Map.of("status",status,"message",message==null?"Could not process the report request":message,"correlationId",id));}
}
