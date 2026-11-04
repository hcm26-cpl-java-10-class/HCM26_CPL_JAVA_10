package com.example.starter_project_2025.system.external_api;

import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalRoomDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalTrainerDTO;
import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ExternalApiServiceImpl implements ExternalApiService {

    RestTemplate restTemplate;
    String baseUrl;
    String token;

    public ExternalApiServiceImpl(
            RestTemplate restTemplate,
            @Value("${external.api.base-url}") String baseUrl,
            @Value("${external.api.token:}") String token) {
        this.restTemplate = restTemplate;
        this.baseUrl = baseUrl;
        this.token = token;
    }

    // ======================== PUBLIC METHODS ========================

    @Override
    public List<ExternalClassDTO> fetchClasses(String status) {
        log.info("Fetching classes from external API with status={}", status);

        UriComponentsBuilder uriBuilder = UriComponentsBuilder
                .fromHttpUrl(baseUrl)
                .path("/api/classes");

        if (status != null && !status.isBlank()) {
            uriBuilder.queryParam("status", status);
        }

        String url = uriBuilder.toUriString();
        return executeGetList(url, new ParameterizedTypeReference<>() {}, "classes");
    }

    @Override
    public ExternalClassDTO fetchClassById(Long id) {
        log.info("Fetching class by id={} from external API", id);

        String url = UriComponentsBuilder
                .fromHttpUrl(baseUrl)
                .path("/api/classes/{id}")
                .buildAndExpand(id)
                .toUriString();

        return executeGet(url, ExternalClassDTO.class, "class (id=" + id + ")");
    }

    @Override
    public ExternalClassDTO createClass(ExternalClassDTO dto) {
        log.info("Creating class in external API: {}", dto.getCode());

        String url = UriComponentsBuilder
                .fromHttpUrl(baseUrl)
                .path("/api/classes")
                .toUriString();

        return executePost(url, dto, ExternalClassDTO.class, "class");
    }

    @Override
    public ExternalClassDTO updateClass(Long id, ExternalClassDTO dto) {
        log.info("Updating class id={} in external API", id);

        String url = UriComponentsBuilder
                .fromHttpUrl(baseUrl)
                .path("/api/classes/{id}")
                .buildAndExpand(id)
                .toUriString();

        return executePut(url, dto, ExternalClassDTO.class, "class (id=" + id + ")");
    }

    @Override
    public void deleteClass(Long id) {
        log.info("Deleting class id={} in external API", id);

        String url = UriComponentsBuilder
                .fromHttpUrl(baseUrl)
                .path("/api/classes/{id}")
                .buildAndExpand(id)
                .toUriString();

        executeDelete(url, "class (id=" + id + ")");
    }

    @Override
    @SuppressWarnings("unchecked")
    public Map<String, Object> batchImportClasses(List<ExternalClassDTO> dtoList) {
        log.info("Batch importing {} classes to external API", dtoList.size());

        String url = UriComponentsBuilder
                .fromHttpUrl(baseUrl)
                .path("/api/classes/batch")
                .toUriString();

        return executePost(url, dtoList, Map.class, "classes batch");
    }

    @Override
    public List<ExternalTrainerDTO> fetchTrainers(String status) {
        log.info("Fetching trainers from external API with status={}", status);

        UriComponentsBuilder uriBuilder = UriComponentsBuilder
                .fromHttpUrl(baseUrl)
                .path("/api/trainers");

        if (status != null && !status.isBlank()) {
            uriBuilder.queryParam("status", status);
        }

        String url = uriBuilder.toUriString();
        return executeGetList(url, new ParameterizedTypeReference<>() {}, "trainers");
    }

    @Override
    public List<ExternalRoomDTO> fetchRooms() {
        log.info("Fetching rooms from external API");

        String url = UriComponentsBuilder
                .fromHttpUrl(baseUrl)
                .path("/api/rooms")
                .toUriString();

        return executeGetList(url, new ParameterizedTypeReference<>() {}, "rooms");
    }

    // ======================== TRAINEES ========================

    @Override
    public Object fetchClassTrainees(Long classId) {
        String url = UriComponentsBuilder.fromHttpUrl(baseUrl)
                .path("/api/classes/{id}/trainees").buildAndExpand(classId).toUriString();
        return executeGetGeneric(url, "class trainees");
    }

    @Override
    public Object fetchAllTrainees() {
        String url = UriComponentsBuilder.fromHttpUrl(baseUrl).path("/api/trainees").toUriString();
        return executeGetGeneric(url, "all trainees");
    }

    @Override
    public Object addTraineeToClass(Long classId, Object body) {
        String url = UriComponentsBuilder.fromHttpUrl(baseUrl)
                .path("/api/classes/{id}/trainees").buildAndExpand(classId).toUriString();
        return executePostGeneric(url, body, "add trainee");
    }

    @Override
    public Object removeTraineeFromClass(Long classId, Long traineeId, Object body) {
        String url = UriComponentsBuilder.fromHttpUrl(baseUrl)
                .path("/api/classes/{classId}/trainees/{traineeId}")
                .buildAndExpand(classId, traineeId).toUriString();
        return executeDeleteWithBody(url, body, "remove trainee");
    }

    // ======================== STATUS LIFECYCLE ========================

    @Override
    public Object fetchClassStatusInfo(Long classId) {
        String url = UriComponentsBuilder.fromHttpUrl(baseUrl)
                .path("/api/classes/{id}/status").buildAndExpand(classId).toUriString();
        return executeGetGeneric(url, "class status info");
    }

    @Override
    public Object transitionClassStatus(Long classId, Object body) {
        String url = UriComponentsBuilder.fromHttpUrl(baseUrl)
                .path("/api/classes/{id}/status").buildAndExpand(classId).toUriString();
        return executePatchGeneric(url, body, "class status transition");
    }

    // ======================== SESSIONS ========================

    @Override
    public Object fetchClassSessions(Long classId) {
        String url = UriComponentsBuilder.fromHttpUrl(baseUrl)
                .path("/api/classes/{id}/sessions").buildAndExpand(classId).toUriString();
        return executeGetGeneric(url, "class sessions");
    }

    @Override
    public Object createClassSession(Long classId, Object body) {
        String url = UriComponentsBuilder.fromHttpUrl(baseUrl)
                .path("/api/classes/{id}/sessions").buildAndExpand(classId).toUriString();
        return executePostGeneric(url, body, "create session");
    }

    @Override
    public void deleteClassSession(Long classId, Long sessionId) {
        String url = UriComponentsBuilder.fromHttpUrl(baseUrl)
                .path("/api/classes/{classId}/sessions/{sessionId}")
                .buildAndExpand(classId, sessionId).toUriString();
        executeDelete(url, "delete session");
    }

    // ======================== ATTENDANCE ========================

    @Override
    public Object fetchSessionAttendance(Long classId, Long sessionId) {
        String url = UriComponentsBuilder.fromHttpUrl(baseUrl)
                .path("/api/classes/{classId}/sessions/{sessionId}/attendance")
                .buildAndExpand(classId, sessionId).toUriString();
        return executeGetGeneric(url, "session attendance");
    }

    @Override
    public Object saveSessionAttendance(Long classId, Long sessionId, Object body) {
        String url = UriComponentsBuilder.fromHttpUrl(baseUrl)
                .path("/api/classes/{classId}/sessions/{sessionId}/attendance")
                .buildAndExpand(classId, sessionId).toUriString();
        return executePutGeneric(url, body, "save attendance");
    }

    // ======================== BUDGET ========================

    @Override
    public Object fetchClassBudget(Long classId) {
        String url = UriComponentsBuilder.fromHttpUrl(baseUrl)
                .path("/api/classes/{id}/budget").buildAndExpand(classId).toUriString();
        return executeGetGeneric(url, "class budget");
    }

    // ======================== AUDIT ========================

    @Override
    public Object fetchAllAudits() {
        String url = UriComponentsBuilder.fromHttpUrl(baseUrl).path("/api/audits").toUriString();
        return executeGetGeneric(url, "audits");
    }

    @Override
    public Object fetchClassAudits(Long classId) {
        String url = UriComponentsBuilder.fromHttpUrl(baseUrl)
                .path("/api/classes/{id}/audits").buildAndExpand(classId).toUriString();
        return executeGetGeneric(url, "class audits");
    }

    @Override
    public Object createAudit(Object body) {
        String url = UriComponentsBuilder.fromHttpUrl(baseUrl).path("/api/audits").toUriString();
        return executePostGeneric(url, body, "create audit");
    }

    // ======================== ANALYTICS ========================

    @Override
    public Object fetchAnalytics() {
        String url = UriComponentsBuilder.fromHttpUrl(baseUrl).path("/api/analytics").toUriString();
        return executeGetGeneric(url, "analytics");
    }

    // ======================== PRIVATE HELPERS ========================

    private HttpHeaders buildHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));

        if (token != null && !token.isBlank()) {
            headers.setBearerAuth(token);
        }

        return headers;
    }

    @Override
    public Object fetchClassCalendars(Long classId) {
        return executeGetGeneric(baseUrl + "/api/classes/" + classId + "/calendars", "class calendars");
    }

    @Override
    public Object saveClassCalendars(Long classId, Object body) {
        return executePutGeneric(baseUrl + "/api/classes/" + classId + "/calendars", body, "class calendars");
    }

    private Object executeGetGeneric(String url, String resourceName) {
        try {
            HttpEntity<Void> entity = new HttpEntity<>(buildHeaders());
            ResponseEntity<Object> response = restTemplate.exchange(url, HttpMethod.GET, entity, Object.class);
            return response.getBody();
        } catch (HttpClientErrorException e) {
            throw new ExternalApiException(e.getResponseBodyAsString(), e.getStatusCode().value(), e.getResponseBodyAsString());
        } catch (Exception e) {
            throw new ExternalApiException("External API error: " + e.getMessage(), e);
        }
    }

    private Object executePostGeneric(String url, Object body, String resourceName) {
        try {
            HttpEntity<Object> entity = new HttpEntity<>(body, buildHeaders());
            ResponseEntity<Object> response = restTemplate.exchange(url, HttpMethod.POST, entity, Object.class);
            return response.getBody();
        } catch (HttpClientErrorException e) {
            throw new ExternalApiException(e.getResponseBodyAsString(), e.getStatusCode().value(), e.getResponseBodyAsString());
        } catch (Exception e) {
            throw new ExternalApiException("External API error: " + e.getMessage(), e);
        }
    }

    private Object executePutGeneric(String url, Object body, String resourceName) {
        try {
            HttpEntity<Object> entity = new HttpEntity<>(body, buildHeaders());
            ResponseEntity<Object> response = restTemplate.exchange(url, HttpMethod.PUT, entity, Object.class);
            return response.getBody();
        } catch (HttpClientErrorException e) {
            throw new ExternalApiException(e.getResponseBodyAsString(), e.getStatusCode().value(), e.getResponseBodyAsString());
        } catch (Exception e) {
            throw new ExternalApiException("External API error: " + e.getMessage(), e);
        }
    }

    private Object executePatchGeneric(String url, Object body, String resourceName) {
        try {
            HttpEntity<Object> entity = new HttpEntity<>(body, buildHeaders());
            ResponseEntity<Object> response = restTemplate.exchange(url, HttpMethod.PATCH, entity, Object.class);
            return response.getBody();
        } catch (HttpClientErrorException e) {
            throw new ExternalApiException(e.getResponseBodyAsString(), e.getStatusCode().value(), e.getResponseBodyAsString());
        } catch (Exception e) {
            throw new ExternalApiException("External API error: " + e.getMessage(), e);
        }
    }

    private Object executeDeleteWithBody(String url, Object body, String resourceName) {
        try {
            HttpEntity<Object> entity = new HttpEntity<>(body, buildHeaders());
            ResponseEntity<Object> response = restTemplate.exchange(url, HttpMethod.DELETE, entity, Object.class);
            return response.getBody();
        } catch (HttpClientErrorException e) {
            throw new ExternalApiException(e.getResponseBodyAsString(), e.getStatusCode().value(), e.getResponseBodyAsString());
        } catch (Exception e) {
            throw new ExternalApiException("External API error: " + e.getMessage(), e);
        }
    }

    private <T> T executeGet(String url, Class<T> responseType, String resourceName) {
        try {
            HttpEntity<Void> entity = new HttpEntity<>(buildHeaders());
            ResponseEntity<T> response = restTemplate.exchange(url, HttpMethod.GET, entity, responseType);

            if (response.getBody() == null) {
                throw new ExternalApiException("External API returned empty body for " + resourceName);
            }
            return response.getBody();
        } catch (HttpClientErrorException e) {
            throw new ExternalApiException(
                    e.getResponseBodyAsString().contains("message") ? e.getResponseBodyAsString() : "External API error: " + e.getStatusCode(),
                    e.getStatusCode().value(),
                    e.getResponseBodyAsString());
        } catch (Exception e) {
            throw new ExternalApiException("External API error: " + e.getMessage(), e);
        }
    }

    private <T, R> R executePost(String url, T body, Class<R> responseType, String resourceName) {
        try {
            HttpEntity<T> entity = new HttpEntity<>(body, buildHeaders());
            ResponseEntity<R> response = restTemplate.exchange(url, HttpMethod.POST, entity, responseType);
            return response.getBody();
        } catch (HttpClientErrorException e) {
            throw new ExternalApiException(
                    e.getResponseBodyAsString(),
                    e.getStatusCode().value(),
                    e.getResponseBodyAsString());
        } catch (Exception e) {
            throw new ExternalApiException("External API error: " + e.getMessage(), e);
        }
    }

    private <T, R> R executePut(String url, T body, Class<R> responseType, String resourceName) {
        try {
            HttpEntity<T> entity = new HttpEntity<>(body, buildHeaders());
            ResponseEntity<R> response = restTemplate.exchange(url, HttpMethod.PUT, entity, responseType);
            return response.getBody();
        } catch (HttpClientErrorException e) {
            throw new ExternalApiException(
                    e.getResponseBodyAsString(),
                    e.getStatusCode().value(),
                    e.getResponseBodyAsString());
        } catch (Exception e) {
            throw new ExternalApiException("External API error: " + e.getMessage(), e);
        }
    }

    private void executeDelete(String url, String resourceName) {
        try {
            HttpEntity<Void> entity = new HttpEntity<>(buildHeaders());
            restTemplate.exchange(url, HttpMethod.DELETE, entity, Void.class);
        } catch (HttpClientErrorException e) {
            throw new ExternalApiException(
                    e.getResponseBodyAsString(),
                    e.getStatusCode().value(),
                    e.getResponseBodyAsString());
        } catch (Exception e) {
            throw new ExternalApiException("External API error: " + e.getMessage(), e);
        }
    }

    private <T> List<T> executeGetList(String url,
                                       ParameterizedTypeReference<List<T>> typeRef,
                                       String resourceName) {
        try {
            HttpEntity<Void> entity = new HttpEntity<>(buildHeaders());
            ResponseEntity<List<T>> response = restTemplate.exchange(url, HttpMethod.GET, entity, typeRef);

            List<T> body = response.getBody();
            return body != null ? body : List.of();
        } catch (HttpClientErrorException e) {
            throw new ExternalApiException(
                    "External API client error for " + resourceName + ": " + e.getStatusCode(),
                    e.getStatusCode().value(),
                    e.getResponseBodyAsString());
        } catch (Exception e) {
            throw new ExternalApiException("External API is unreachable for " + resourceName + ": " + e.getMessage(), e);
        }
    }
}
