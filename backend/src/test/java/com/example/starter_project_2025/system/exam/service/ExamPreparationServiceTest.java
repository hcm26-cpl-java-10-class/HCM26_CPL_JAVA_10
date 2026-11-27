package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.exam.attempt.domain.*;
import com.example.starter_project_2025.system.exam.attempt.service.ExamAttemptService;
import com.example.starter_project_2025.system.exam.core.domain.*;
import com.example.starter_project_2025.system.exam.courselink.service.ExamProgressLockService;
import com.example.starter_project_2025.system.exam.integrity.domain.ExamProctorImageRepository;
import com.example.starter_project_2025.system.exam.invitation.domain.InvitationRepository;
import com.example.starter_project_2025.system.exam.pool.domain.ExamQuestionPoolVersionRepository;
import com.example.starter_project_2025.system.exam.pool.service.ExamPoolAttemptSnapshotService;
import com.example.starter_project_2025.system.exam.pool.service.ExamPoolRandomSelectionService;
import com.example.starter_project_2025.system.exam.result.service.ExamResultAccessService;
import com.example.starter_project_2025.system.question.core.domain.*;
import com.example.starter_project_2025.system.question.core.mapper.QuestionTakerMapper;
import com.example.starter_project_2025.system.rbac.user.*;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExamPreparationServiceTest {
    @Mock

    ExamR

    posit

    ry ex

    ms;

    @Mock

    ExamA

    tempt

    eposi
    ory attempts;

    @Mock

    U

    pository
    u se

    s;

    @Mock 
        
          
          


    
    
     
        
       
         
            
        
         
         
    Quest  
            
     

         
    
           
                
         
           
        
        
         
     

    onTak
    rMapper mapper;

    @Mock

    Invit

    tionRepository invitations;

    @

    ExamResul
    t Ac

    essServic e results;

    @Mock

    ExamP octor
    mageRepository i
    m a ges;

    @Mock  
            
     

         
    
           
                
         
           
        
        
         
     

    ExamP
    ogressLockServ ice progress

    @Mock

    ExamQuestionPoolVers ionRepository pools;

    @Mock

    ExamPoolRandomSelectionServ ice
    s e lection;
    @

    ExamPoolAttemptSnapshotService
    sn apshots;

    @InjectMo
    c ks

    ExamAttem p
    tService service;

    Exam exam;

    @Befo 
    eEach    
    void setup() {   
         
            
        
         
         
        exam = new Exam();
            
     

         
    
           
                
        exam.setId(1L); 
        exam.setTit l e("Java"); 
        exam.setIsActive(true);
        
         
     

        e

    am.setDuration Minutes(60);
             
           
         
     

        e
    am.setPassScore(new BigDecimal("6"));

    exam. s etAccessCode("PRIVATE_PASSWORD");
        
        Question question = new Question(); 
        question . setId(9L); 
        question.setIsActive(true);
        
         
        question.setPoints(1);

    question.setCont ent("PRIVATE_QUESTION
        ");  
     

        e
    am.setQuestions(Set.of(question));
        lenient().when(exams.fi
        ndByI d (1L)).thenReturn(Optional.of(exam));
    }

    ExamAttempt attempt(ExamAttemptSt
        atus status) {
         
        var a = new   ExamAttempt();
        
        
        
        a.setId(5L);
     

        a
    setStudent(User.builder().id(7L).build());
        a.set A ttemptNumber(1);
        a.setStatus(status); 
        a.setDurationMinutes(60);
         
        a.setSta r tedAt(Instant.now()); 
        a.setDeadlineAt(Instant.now( ).plusSeconds(3600));
        
        a.setFinalScore( BigDecimal.TEN); 
        return a;  
    }

    @Test 
    void readingRepeatedlyNeverAllocatesAttemptOr
    Re ve

    alsSecrets() throws Exc eption {
        var metadata = s
        ervice.preparation(1L, 7L);

    service. p reparation(1L, 7L); 
        
         
         
        assertTrue(metadata.canS
        tart());    
     

        a
    sertEquals(2, metadata.attemptsRemaining());
        assertEquals(1, metad a ta.questionCount());
                
        assertEquals(new BigDecimal("6"), metadata.passScore());
        String json = new ObjectMapper().wr iteValueAsString(metadata);
        assertFalse(json.contains("PRIVATE_QUESTION"));
        
        assertFalse(json.contains("PRIVATE_ PASSWORD"));
     

        v
    rify(attempts, never()).save(any());
        verify(exams, never()).lockForAttemptStart(an y( )) ;

    verifyNoInter actions(selection, snapshots, users)
        ; 
    }

    @Test
    void latestActiveAttemptRetainsDeadlineAndDoesNotExpireDuringOverview() {
        var a = attempt(ExamAttemptStatus.IN_PROGRESS);
        a.setDeadlineAt(Instant.now().minusSeconds(10));
        when(attempts.findAllByExam_IdAndStudent_IdOrderByAttemptNumberAsc(1L, 7L)).thenReturn(List.of(a));
        var data = service.preparation(1L, 7L);
        assertTrue(data.canResume());
        assertFalse(data.canStart());
        assertEquals(a.getDeadlineAt(), data.attempts().getFirst().summary().getDeadlineAt());
        assertEquals(ExamAttemptStatus.IN_PROGRESS, a.getStatus());
        assertNotNull(data.unavailableReason());
        verify(attempts, never()).save(any());
        verify(attempts, never()).lockByIdAndStudentId(any(), any());
    }

    @Test
    void exhaustedAttemptHasNoRetryAndUnpublishedScoresStayPrivate() {
        exam.setMaxAttempts(1);
        var a = attempt(ExamAttemptStatus.SUBMITTED);
        when(attempts.findAllByExam_IdAndStudent_IdOrderByAttemptNumberAsc(1L, 7L)).thenReturn(List.of(a));
        var data = service.preparation(1L, 7L);
        assertFalse(data.canStart());
        assertFalse(data.canResume());
        assertEquals(0, data.attemptsRemaining());
        var summary = data.attempts().getFirst().summary();
        assertFalse(summary.isResultPublished());
        assertNull(summary.getFinalScore());
        assertNull(summary.getPassed());
        assertFalse(data.attempts().getFirst().canReview());
    }

    @Test
    void publishedScoresAndPermittedReviewAreExposedOnlyForOwnAttempt() {
        var a = attempt(ExamAttemptStatus.SUBMITTED);
        when(attempts.findAllByExam_IdAndStudent_IdOrderByAttemptNumberAsc(1L, 7L)).thenReturn(List.of(a));
        when(results.isResultPublished(exam)).thenReturn(true);
        when(results.canStudentViewOwnSubmission(exam, a.getStatus())).thenReturn(true);
        var data = service.preparation(1L, 7L);
        assertEquals(BigDecimal.TEN, data.attempts().getFirst().summary().getFinalScore());
        assertTrue(data.attempts().getFirst().canReview());
        verify(attempts, atLeastOnce()).findAllByExam_IdAndStudent_IdOrderByAttemptNumberAsc(1L, 7L);
        verify(attempts, never()).findAllByExam_IdAndStudent_IdOrderByAttemptNumberAsc(1L, 8L);
    }

    @Test
    void inactiveAndUnenrolledAreDeniedAndProgressLocksAreReported() {
        doThrow(new AccessDeniedException("Enrollment required")).when(progress).assertCanViewAssessment(exam, 7L);
        assertThrows(AccessDeniedException.class, () -> service.preparation(1L, 7L));
        reset(progress);
        doThrow(new AccessDeniedException("Complete lessons")).when(progress).assertUnlocked(exam, 7L);
        var data = service.preparation(1L, 7L);
        assertFalse(data.canStart());
        assertEquals("Complete lessons", data.unavailableReason());
        assertEquals(1, data.questionCount());
        exam.setIsActive(false);
        assertThrows(ResourceNotFoundException.class, () -> service.preparation(1L, 7L));
    }

    @Test
    void invitationAndEmptyQuestionPoolBlockStart() {
        Invitation invitation = Invitation.builder().id(3L).exam(exam).user(User.builder().id(7L).build())
                .status(InvitationStatus.PENDING).build();
        when(invitations.findByExamId(1L)).thenReturn(List.of(invitation));
        assertFalse(service.preparation(1L, 7L).canStart());
        when(invitations.findByExamId(1L)).thenReturn(List.of());
        exam.setQuestions(Set.of());
        assertFalse(service.preparation(1L, 7L).canStart());
    }

    @Test
    void currentTakingPageReadCannotCreateAnAttempt() {
        assertThrows(ResourceNotFoundException.class, () -> service.currentAttempt(1L, 7L));
        verify(exams, never()).lockForAttemptStart(any());
        verify(attempts, never()).save(any());
    }
}
