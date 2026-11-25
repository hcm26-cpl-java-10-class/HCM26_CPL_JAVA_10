package com.example.starter_project_2025.system.external_api;

import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

/** In-memory HTTP fixtures only; no application context, live server, or database. */
class ExternalTrainerDirectoryContractTest {
    private static final String URL = "https://directory.example.test/api/trainers?status=active";
    private static final String TRAINERS = """
        [{"id":9100,"name":"Verified Trainer","email":"trainer@example.test","status":"active"}]
        """;
    private ExternalApiServiceImpl directory;
    private MockRestServiceServer upstream;

    @BeforeEach
    void setUp() {
        var rest = new RestTemplate();
        upstream = MockRestServiceServer.bindTo(rest).build();
        directory = new ExternalApiServiceImpl(rest, "https://directory.example.test", "test-directory-token");
    }

    @Test
    void forwardsActiveFilterAndPreservesMasterIdentity() {
        upstream.expect(requestTo(URL)).andExpect(method(HttpMethod.GET))
            .andExpect(header("Authorization", "Bearer test-directory-token"))
            .andRespond(withSuccess(TRAINERS, MediaType.APPLICATION_JSON));
        var trainers = directory.fetchTrainers("active");
        assertEquals(1, trainers.size());
        assertEquals(9100L, trainers.getFirst().getId());
        assertEquals("Verified Trainer", trainers.getFirst().getName());
        assertEquals("trainer@example.test", trainers.getFirst().getEmail());
        assertEquals("active", trainers.getFirst().getStatus());
        upstream.verify();
    }

    @Test
    void sampleHeaderCannotBeOverriddenByRealLookingNamesOrLaterResponses() {
        upstream.expect(requestTo(URL)).andRespond(withSuccess(TRAINERS, MediaType.APPLICATION_JSON)
            .header("X-Data-Source", "sample"));
        upstream.expect(requestTo(URL)).andRespond(withSuccess(TRAINERS, MediaType.APPLICATION_JSON));
        directory.fetchTrainers("active");
        assertTrue(directory.isSampleData());
        directory.fetchTrainers("active");
        assertTrue(directory.isSampleData());
        upstream.verify();
    }

    @Test
    void configuredSampleDirectoryStaysSampleWithoutAHeader() {
        ReflectionTestUtils.setField(directory, "configuredSampleData", true);
        upstream.expect(requestTo(URL)).andRespond(withSuccess(TRAINERS, MediaType.APPLICATION_JSON));
        directory.fetchTrainers("active");
        assertTrue(directory.isSampleData());
        upstream.verify();
    }

    @ParameterizedTest
    @ValueSource(ints = {401, 403, 404, 500})
    void upstreamHttpErrorsRemainFailuresWithoutSampleFallback(int status) {
        upstream.expect(requestTo(URL)).andRespond(withStatus(HttpStatus.valueOf(status)));
        var failure = assertThrows(ExternalApiException.class, () -> directory.fetchTrainers("active"));
        assertEquals(status, failure.getStatusCode());
        upstream.verify();
    }
}
