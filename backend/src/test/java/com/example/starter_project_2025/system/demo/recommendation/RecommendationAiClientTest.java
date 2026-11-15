package com.example.starter_project_2025.system.demo.recommendation;

import com.example.starter_project_2025.system.demo.aicourse.AiTextClient;
import com.example.starter_project_2025.system.exam.service.ai.AiGradingProperties;
import com.example.starter_project_2025.exception.BadRequestException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;

/** Exercises the actual shared HTTP client using a local provider, without real keys or internet. */
class RecommendationAiClientTest {
    HttpServer server;
    AiGradingProperties properties=new AiGradingProperties();
    ObjectMapper mapper=new ObjectMapper();
    @BeforeEach void setup() throws Exception {
        server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        properties.setApiKey("test-only-key");
        properties.setEndpoint("http://127.0.0.1:"+server.getAddress().getPort()+"/models");
        server.start();
    }
    @AfterEach void stop(){server.stop(0);}
    AiTextClient client(){return new AiTextClient(properties,mapper);}
    @ParameterizedTest @ValueSource(ints={429,500,403})
    void providerFailureMakesOnlyOneAttempt(int status){
        AtomicInteger attempts=new AtomicInteger();
        server.createContext("/models",exchange->{attempts.incrementAndGet();exchange.sendResponseHeaders(status,-1);exchange.close();});
        assertThrows(BadRequestException.class,()->client().generateRecommendationJson("choose",List.of(new AiTextClient.Turn("user","Java"))));
        assertEquals(1,attempts.get());
    }
    @Test void malformedJsonMakesOnlyOneAttempt(){
        AtomicInteger attempts=new AtomicInteger();
        server.createContext("/models",exchange->{attempts.incrementAndGet();byte[] body="{}".getBytes(StandardCharsets.UTF_8);exchange.sendResponseHeaders(200,body.length);exchange.getResponseBody().write(body);exchange.close();});
        assertThrows(BadRequestException.class,()->client().generateRecommendationJson("choose",List.of(new AiTextClient.Turn("user","Java"))));assertEquals(1,attempts.get());
    }
    @Test void boundedOutputAndSharedAuthenticationAreUsed() throws Exception {
        AtomicInteger checked=new AtomicInteger();
        server.createContext("/models",exchange->{
            var request=mapper.readTree(exchange.getRequestBody());
            if (request.path("generationConfig").path("maxOutputTokens").asInt()==2048 && "test-only-key".equals(exchange.getRequestHeaders().getFirst("x-goog-api-key"))) checked.incrementAndGet();
            var inner=mapper.writeValueAsString(java.util.Map.of("reply","Try Java","courseIds",List.of(1)));
            byte[] body=mapper.writeValueAsBytes(java.util.Map.of("candidates",List.of(java.util.Map.of("content",java.util.Map.of("parts",List.of(java.util.Map.of("text",inner)))))));
            exchange.sendResponseHeaders(200,body.length);exchange.getResponseBody().write(body);exchange.close();
        });
        assertEquals(1,client().generateRecommendationJson("choose",List.of(new AiTextClient.Turn("user","Java"))).path("courseIds").get(0).asInt());assertEquals(1,checked.get());
    }
    @Test void missingConfigurationDoesNotCallProvider(){
        properties.setApiKey("");assertFalse(client().isConfigured());
        assertThrows(BadRequestException.class,()->client().generateRecommendationJson("choose",List.of()));
    }
    @Test void readTimeoutIsBoundedAndDoesNotRetry(){
        AtomicInteger attempts=new AtomicInteger();
        server.createContext("/models",exchange->{attempts.incrementAndGet();try{Thread.sleep(22000);}catch(InterruptedException e){Thread.currentThread().interrupt();}exchange.close();});
        long start=System.nanoTime();
        assertThrows(BadRequestException.class,()->client().generateRecommendationJson("choose",List.of(new AiTextClient.Turn("user","Java"))));
        double seconds=(System.nanoTime()-start)/1_000_000_000.0;
        assertTrue(seconds>=19 && seconds<28,"Recommendation timeout took "+seconds+" seconds");assertEquals(1,attempts.get());
    }
}
