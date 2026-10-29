package com.example.starter_project_2025.system.schedule;

import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import java.util.List;

@Component
@Profile("!schedule-demo")
public class ExternalScheduleReferenceProvider implements ScheduleReferenceProvider {
    private final ExternalApiService resources;
    private final RestTemplate http;
    private final String baseUrl;
    private final String token;
    private final String assignmentsPath;
    private final String holidaysPath;

    public ExternalScheduleReferenceProvider(ExternalApiService resources, RestTemplate http,
            @Value("${external.api.base-url}") String baseUrl,
            @Value("${external.api.token:}") String token,
            @Value("${schedule.references.assignments-path:/api/teaching-assignments}") String assignmentsPath,
            @Value("${schedule.references.holidays-path:/api/holidays}") String holidaysPath) {
        this.resources = resources;
        this.http = http;
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.token = token;
        this.assignmentsPath = assignmentsPath;
        this.holidaysPath = holidaysPath;
    }

    @Override
    public ScheduleReferences load() {
        return new ScheduleReferences(resources.fetchClasses(null), resources.fetchTrainers(null),
                resources.fetchRooms(), read(assignmentsPath, new ParameterizedTypeReference<List<ScheduleReferences.Assignment>>() {}),
                read(holidaysPath, new ParameterizedTypeReference<List<ScheduleReferences.Holiday>>() {}));
    }

    @Override
    public ScheduleReferences loadResources() {
        return new ScheduleReferences(resources.fetchClasses(null), resources.fetchTrainers(null), resources.fetchRooms(),
                List.of(), read(holidaysPath, new ParameterizedTypeReference<List<ScheduleReferences.Holiday>>() {}));
    }

    private <T> List<T> read(String path, ParameterizedTypeReference<List<T>> type) {
        try {
            HttpHeaders headers = new HttpHeaders();
            if (!token.isBlank()) headers.setBearerAuth(token);
            List<T> body = http.exchange(baseUrl + path, HttpMethod.GET, new HttpEntity<>(headers), type).getBody();
            if (body == null) throw new IllegalStateException("Scheduling reference data is unavailable.");
            return body;
        } catch (RuntimeException ex) {
            if (resources.isSampleData()) {
                return List.of();
            }
            // Do not permit a save when shared reference data cannot be verified.
            throw new ExternalApiException("Scheduling reference data could not be loaded. Please try again later.", ex);
        }
    }
}
