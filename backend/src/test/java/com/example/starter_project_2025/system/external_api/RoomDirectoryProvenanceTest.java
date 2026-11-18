package com.example.starter_project_2025.system.external_api;

import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class RoomDirectoryProvenanceTest {
    private final RestTemplate http = new RestTemplate();
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(http).build();
    private final ExternalApiServiceImpl service = new ExternalApiServiceImpl(http, "https://directory.example.test", "");

    @Test void sampleHeaderIsReportedEvenWhenTheHttpDirectoryIsReachable() {
        server.expect(requestTo("https://directory.example.test/api/rooms"))
            .andRespond(withSuccess("[{\"id\":1,\"name\":\"Room A\",\"capacity\":20}]", MediaType.APPLICATION_JSON)
                .header("X-Data-Source", "sample"));
        assertFalse(service.isSampleData());
        assertEquals(1, service.fetchRooms().size());
        assertTrue(service.isSampleData());
        server.verify();
    }

    @Test void explicitlyConfiguredSampleUpstreamCannotMasqueradeAsReal() {
        ReflectionTestUtils.setField(service, "configuredSampleData", true);
        assertTrue(service.isSampleData());
    }

    @Test void failedRoomApiPropagatesFailureWithoutSampleRooms() {
        server.expect(requestTo("https://directory.example.test/api/rooms")).andRespond(withServiceUnavailable());
        var failure = assertThrows(ExternalApiException.class, service::fetchRooms);
        assertEquals(503, failure.getStatusCode());
        server.verify();
    }
}
