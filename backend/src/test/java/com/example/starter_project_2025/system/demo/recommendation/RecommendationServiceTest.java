package com.example.starter_project_2025.system.demo.recommendation;
import com.example.starter_project_2025.system.demo.aicourse.AiTextClient;
import com.example.starter_project_2025.system.demo.lesson.CatalogCourseDTO;
import com.example.starter_project_2025.system.demo.course.CourseLevel;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.example.starter_project_2025.system.demo.recommendation.RecommendationModels.*;

class RecommendationServiceTest {
    RecommendationData data=mock(RecommendationData.class);
    AiTextClient ai=mock(AiTextClient.class);
    ObjectMapper mapper=new ObjectMapper();
    RecommendationService service=new RecommendationService(data,ai,mapper);
    static CatalogCourseDTO course(long id,String category,CourseLevel level,long duration) {
        return new CatalogCourseDTO(id,"Course "+id,"Public description",null,null,id,category,level,3,duration,true,false,4,10);
    }
    static Item item(long id) { return new Item(course(id,"Java",CourseLevel.BEGINNER,100),"An introductory option to explore."); }
    Result result(List<Item> items) { return new Result(items,new Preferences("Learn Java",Set.of("Java")),items.isEmpty()?"EMPTY_CATALOG":"READY"); }
    ChatRequest request() { return new ChatRequest("What should I learn?",List.of(),"en"); }
    @Test void missingKeyReturnsAutomaticCardsWithoutCallingProvider() {
        when(data.automatic(1L)).thenReturn(result(List.of(item(3))));
        var r=service.ask(1L,request());assertEquals("UNAVAILABLE",r.aiStatus());assertEquals(3L,r.recommendations().getFirst().course().id());
        verify(ai,never()).generateRecommendationJson(anyString(),anyList());
    }
    @Test void emptyCatalogDoesNotSpendProviderQuota() {
        when(data.automatic(1L)).thenReturn(result(List.of()));
        assertEquals("EMPTY_CATALOG",service.ask(1L,request()).state());verifyNoInteractions(ai);
    }
    @Test void unmatchedSavedPreferencesAreExplainedWithoutCallingProvider() {
        when(data.automatic(1L)).thenReturn(new Result(List.of(),new Preferences("Java",Set.of()),"NO_MATCHES"));
        var response=service.ask(1L,request());
        assertEquals("NO_MATCHES",response.state());assertTrue(response.reply().contains("saved goals"));
        assertEquals("NOT_NEEDED",response.aiStatus());verifyNoInteractions(ai);
    }
    @ParameterizedTest @ValueSource(strings={"{}","{\"reply\":\"ok\",\"courseIds\":[999]}","{\"reply\":\"ok\",\"courseIds\":[3.5]}","{\"reply\":\"ok\",\"courseIds\":[\"3\"]}","{\"reply\":\"\",\"courseIds\":[]}"})
    void invalidProviderOutputFallsBack(String json) throws Exception {
        when(data.automatic(1L)).thenReturn(result(List.of(item(3))));when(ai.isConfigured()).thenReturn(true);
        when(ai.generateRecommendationJson(anyString(),anyList())).thenReturn(mapper.readTree(json));
        var r=service.ask(1L,request());assertEquals("UNAVAILABLE",r.aiStatus());assertEquals(3L,r.recommendations().getFirst().course().id());
    }
    @ParameterizedTest @ValueSource(strings={"timeout","quota","malformed"})
    void providerFailuresFallBackAndDoNotLeakErrors(String failure) {
        when(data.automatic(1L)).thenReturn(result(List.of(item(3))));when(ai.isConfigured()).thenReturn(true);
        when(ai.generateRecommendationJson(anyString(),anyList())).thenThrow(new RuntimeException("SECRET "+failure));
        var r=service.ask(1L,request());assertEquals("UNAVAILABLE",r.aiStatus());assertFalse(r.reply().contains("SECRET"));
        assertTrue(service.acquire(1L,System.currentTimeMillis()+16000));service.release(1L);
    }
    @Test void deduplicatesIdsAndUsesDatabaseCardFields() throws Exception {
        when(data.automatic(1L)).thenReturn(result(List.of(item(3))));when(ai.isConfigured()).thenReturn(true);
        when(ai.generateRecommendationJson(anyString(),anyList())).thenReturn(mapper.readTree("{\"reply\":\"Consider this option\",\"courseIds\":[3,3],\"title\":\"fabricated\",\"url\":\"bad\"}"));
        var r=service.ask(1L,request());assertEquals("AVAILABLE",r.aiStatus());assertEquals(1,r.recommendations().size());assertEquals("Course 3",r.recommendations().getFirst().course().name());
    }
    @Test void rechecksEligibilityAfterProviderReturns() throws Exception {
        when(data.automatic(1L)).thenReturn(result(List.of(item(3))),result(List.of()));when(ai.isConfigured()).thenReturn(true);
        when(ai.generateRecommendationJson(anyString(),anyList())).thenReturn(mapper.readTree("{\"reply\":\"Try this\",\"courseIds\":[3]}"));
        assertTrue(service.ask(1L,request()).recommendations().isEmpty());
    }
    @Test void honestNoMatchesIsDifferentFromProviderUnavailable() throws Exception {
        when(data.automatic(1L)).thenReturn(result(List.of(item(3))));when(ai.isConfigured()).thenReturn(true);
        when(ai.generateRecommendationJson(anyString(),anyList())).thenReturn(mapper.readTree("{\"reply\":\"No matches for that goal\",\"courseIds\":[]}"));
        var r=service.ask(1L,request());assertEquals("AVAILABLE",r.aiStatus());assertEquals("NO_MATCHES",r.state());
    }
    @Test void sendsCurrentMessageOnceAndNoOtherAccountInformation() throws Exception {
        when(data.automatic(8L)).thenReturn(result(List.of(item(3))));when(ai.isConfigured()).thenReturn(true);
        when(ai.generateRecommendationJson(anyString(),anyList())).thenReturn(mapper.readTree("{\"reply\":\"Đây là gợi ý\",\"courseIds\":[3]}"));
        service.ask(8L,new ChatRequest("dễ hơn",List.of(new Turn("user","Java"),new Turn("assistant","Course 3 (ID 3)")),"vi"));
        @SuppressWarnings("unchecked") ArgumentCaptor<List<AiTextClient.Turn>> turns=ArgumentCaptor.forClass(List.class);
        verify(ai).generateRecommendationJson(anyString(),turns.capture());
        assertEquals(1,turns.getValue().stream().filter(t->t.text().equals("dễ hơn")).count());
        String payload=turns.getValue().getFirst().text();assertTrue(payload.contains("contentSeconds"));
        assertFalse(payload.contains("email"));assertFalse(payload.contains("studentAnswer"));verify(data,times(2)).automatic(8L);verify(data,never()).automatic(1L);
    }
    @Test void shorterAndEasierFollowupsWorkWithoutProviderInBothLanguages() {
        var items=List.of(new Item(course(1,"Java",CourseLevel.ADVANCED,10),"x"),new Item(course(2,"Java",CourseLevel.BEGINNER,400),"x"),new Item(course(3,"Java",CourseLevel.BEGINNER,50),"x"));
        for (String easier:List.of("something easier","dễ hơn")) {
            var q=new ChatRequest("shorter courses",List.of(new Turn("user",easier)),"en");
            assertEquals(List.of(3L,2L),RecommendationService.filter(items,q).stream().map(i->i.course().id()).toList());
        }
        assertEquals(3L,RecommendationService.filter(items,new ChatRequest("ngắn hơn",List.of(new Turn("user","cơ bản")),"vi")).getFirst().course().id());
    }
    @Test void usageIsPerAccountLimitedAndSingleFlight() {
        long now=10_000_000;assertTrue(service.acquire(1L,now));assertFalse(service.acquire(1L,now+16000));
        assertTrue(service.acquire(2L,now));service.release(2L);service.release(1L);
        assertFalse(service.acquire(1L,now+1000));
        for(int i=1;i<10;i++){ assertTrue(service.acquire(1L,now+i*16000));service.release(1L); }
        assertFalse(service.acquire(1L,now+200000));assertTrue(service.acquire(1L,now+3_600_001));service.release(1L);
    }
    @Test void globalProviderConcurrencyIsBounded() {
        for(long id=1;id<=8;id++)assertTrue(service.acquire(id,10_000_000));
        assertFalse(service.acquire(9L,10_000_000));service.release(1L);assertTrue(service.acquire(9L,10_000_000));
    }
    @Test void automaticReturnsBoundedShortlistForPagination() {
        when(data.automatic(1L)).thenReturn(result(java.util.stream.LongStream.range(1,20).mapToObj(RecommendationServiceTest::item).toList()));
        assertEquals(19,service.automatic(1L).recommendations().size());
    }
    @Test void providerSupportsMultiplePagesAndHidesIdsInReply() throws Exception {
        var items=java.util.stream.LongStream.rangeClosed(1,30).mapToObj(RecommendationServiceTest::item).toList();
        when(data.automatic(1L)).thenReturn(result(items));when(ai.isConfigured()).thenReturn(true);
        when(ai.generateRecommendationJson(anyString(),anyList())).thenReturn(mapper.readTree("{\"reply\":\"Course 1 (ID 1), Course 7 (ID 7)\",\"courseIds\":[1,2,3,4,5,6,7,8]}"));
        var response=service.ask(1L,request());
        assertEquals(8,response.recommendations().size());assertFalse(response.reply().contains("ID"));
        assertEquals(30,service.automatic(1L).recommendations().size());
        assertEquals(30,RecommendationService.fallback(items,false,"UNAVAILABLE").recommendations().size());
    }
}
