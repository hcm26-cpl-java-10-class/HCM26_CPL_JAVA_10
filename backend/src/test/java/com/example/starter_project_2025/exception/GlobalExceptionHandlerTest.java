package com.example.starter_project_2025.exception;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatusCode;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class GlobalExceptionHandlerTest {

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(new ErrorTestController())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @ParameterizedTest
    @ValueSource(ints = {400, 404, 409, 502})
    void shouldPreserveResponseStatus(int expectedStatus) throws Exception {
        mockMvc.perform(get("/test/errors")
                        .param("status", String.valueOf(expectedStatus)))
                .andExpect(status().is(expectedStatus))
                .andExpect(jsonPath("$.status").value(expectedStatus))
                .andExpect(jsonPath("$.message").value("Calendar request failed"));
    }

    @RestController
    static class ErrorTestController {

        @GetMapping("/test/errors")
        public void fail(
                @org.springframework.web.bind.annotation.RequestParam("status")
                int status) {

            throw new ResponseStatusException(
                    HttpStatusCode.valueOf(status),
                    "Calendar request failed"
            );
        }
    }
}