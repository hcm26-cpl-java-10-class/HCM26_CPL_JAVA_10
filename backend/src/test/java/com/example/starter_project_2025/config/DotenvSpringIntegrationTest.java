package com.example.starter_project_2025.config;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.test.context.TestPropertySource;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(classes = {DotenvSpringIntegrationTest.TestConfig.class})
@TestPropertySource(properties = {
        "test.ai.api-key=${CUSTOM_DOTENV_KEY:default-key}",
        "test.ai.system-priority=${GEMINI_API_KEY:default-key}"
})
class DotenvSpringIntegrationTest {

    private static final Path TEMP_ENV_FILE;

    static {
        try {
            TEMP_ENV_FILE = Files.createTempFile("dotenv-spring-test-", ".env");
            Files.writeString(TEMP_ENV_FILE, """
                    CUSTOM_DOTENV_KEY=AIzaSyLoadedFromDotenvSuccessfully
                    GEMINI_API_KEY=AIzaSyValueInDotenvThatShouldBeOverriddenBySystemEnv
                    """);
            System.setProperty("dotenv.file", TEMP_ENV_FILE.toAbsolutePath().toString());
            DotenvLoader.resetCache();
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    @AfterAll
    static void cleanup() {
        System.clearProperty("dotenv.file");
        System.clearProperty("CUSTOM_DOTENV_KEY");
        DotenvLoader.resetCache();
        if (TEMP_ENV_FILE != null) {
            try {
                Files.deleteIfExists(TEMP_ENV_FILE);
            } catch (IOException ignored) {}
        }
    }

    @Configuration
    @EnableConfigurationProperties(TestProperties.class)
    static class TestConfig {}

    @ConfigurationProperties(prefix = "test.ai")
    static class TestProperties {
        private String apiKey;
        private String systemPriority;

        public String getApiKey() {
            return apiKey;
        }

        public void setApiKey(String apiKey) {
            this.apiKey = apiKey;
        }

        public String getSystemPriority() {
            return systemPriority;
        }

        public void setSystemPriority(String systemPriority) {
            this.systemPriority = systemPriority;
        }
    }

    @Autowired
    private Environment environment;

    @Autowired
    private TestProperties testProperties;

    @Test
    void environment_loadsVariablesFromDotenvFile() {
        assertEquals("AIzaSyLoadedFromDotenvSuccessfully", environment.getProperty("CUSTOM_DOTENV_KEY"));
        assertEquals("AIzaSyLoadedFromDotenvSuccessfully", testProperties.getApiKey());
    }

    @Test
    void environment_prioritizesSystemEnvironmentOverDotenvFile() {
        String systemEnvKey = System.getenv("GEMINI_API_KEY");
        if (systemEnvKey != null && !systemEnvKey.isBlank()) {
            // When system environment is present, it must take precedence over the value in .env
            assertEquals(systemEnvKey, environment.getProperty("GEMINI_API_KEY"));
            assertEquals(systemEnvKey, testProperties.getSystemPriority());
            assertNotEquals("AIzaSyValueInDotenvThatShouldBeOverriddenBySystemEnv", testProperties.getSystemPriority());
        }
    }
}
