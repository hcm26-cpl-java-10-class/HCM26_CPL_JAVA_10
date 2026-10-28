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
import org.springframework.context.annotation.Profile;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;

@Slf4j
@Service
@Profile("!local")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ExternalApiServiceImpl implements ExternalApiService {

    RestTemplate restTemplate;
    String baseUrl;
    String token;
    ManagedClassDirectory managedClasses;
    ManagedTrainerDirectory managedTrainers;

    public ExternalApiServiceImpl(
            RestTemplate restTemplate,
            @Value("${external.api.base-url}") String baseUrl,
            @Value("${external.api.token:}") String token,
            ManagedClassDirectory managedClasses, ManagedTrainerDirectory managedTrainers) {
        this.restTemplate = restTemplate;
        this.baseUrl = baseUrl;
        this.token = token;
        this.managedClasses = managedClasses;
        this.managedTrainers = managedTrainers;
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
        return managedClasses.merge(executeGetList(url, new ParameterizedTypeReference<List<ExternalClassDTO>>() {
        }, "classes"), status);
    }

    @Override
    public ExternalClassDTO fetchClassById(Long id) {
        var managed = managedClasses.find(id);
        if (managed.isPresent()) return managed.get();
        log.info("Fetching class by id={} from external API", id);

        String url = UriComponentsBuilder
                .fromHttpUrl(baseUrl)
                .path("/api/classes/{id}")
                .buildAndExpand(id)
                .toUriString();

        return executeGet(url, ExternalClassDTO.class, "class (id=" + id + ")");
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
        return managedTrainers.merge(executeGetList(url, new ParameterizedTypeReference<List<ExternalTrainerDTO>>() {
        }, "trainers"), status);
    }

    @Override
    public List<ExternalRoomDTO> fetchRooms() {
        log.info("Fetching rooms from external API");

        String url = UriComponentsBuilder
                .fromHttpUrl(baseUrl)
                .path("/api/rooms")
                .toUriString();

        return executeGetList(url, new ParameterizedTypeReference<>() {
        }, "rooms");
    }

    // ======================== PRIVATE HELPERS ========================

    /**
     * Build HTTP headers with optional Bearer token.
     */
    private HttpHeaders buildHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));

        if (token != null && !token.isBlank()) {
            headers.setBearerAuth(token);
        }

        return headers;
    }

    /**
     * Execute a GET request that returns a single object.
     */
    private <T> T executeGet(String url, Class<T> responseType, String resourceName) {
        try {
            HttpEntity<Void> entity = new HttpEntity<>(buildHeaders());

            ResponseEntity<T> response = restTemplate.exchange(
                    url, HttpMethod.GET, entity, responseType);

            if (response.getBody() == null) {
                throw new ExternalApiException(
                        "External API returned empty body for " + resourceName);
            }

            log.debug("Successfully fetched {} from external API", resourceName);
            return response.getBody();

        } catch (HttpClientErrorException e) {
            log.error("Client error fetching {} from external API: {} - {}",
                    resourceName, e.getStatusCode(), e.getResponseBodyAsString());
            throw new ExternalApiException(
                    "External API client error for " + resourceName + ": " + e.getStatusCode(),
                    e.getStatusCode().value(),
                    e.getResponseBodyAsString());

        } catch (HttpServerErrorException e) {
            log.error("Server error fetching {} from external API: {} - {}",
                    resourceName, e.getStatusCode(), e.getResponseBodyAsString());
            throw new ExternalApiException(
                    "External API server error for " + resourceName + ": " + e.getStatusCode(),
                    e.getStatusCode().value(),
                    e.getResponseBodyAsString());

        } catch (ResourceAccessException e) {
            log.error("Timeout/connection error fetching {} from external API: {}",
                    resourceName, e.getMessage());
            throw new ExternalApiException(
                    "External API is unreachable for " + resourceName + ": " + e.getMessage(), e);
        }
    }

    /**
     * Execute a GET request that returns a list of objects.
     */
    private <T> List<T> executeGetList(String url,
            ParameterizedTypeReference<List<T>> typeRef,
            String resourceName) {
        try {
            HttpEntity<Void> entity = new HttpEntity<>(buildHeaders());

            ResponseEntity<List<T>> response = restTemplate.exchange(
                    url, HttpMethod.GET, entity, typeRef);

            List<T> body = response.getBody();
            if (body == null) {
                log.warn("External API returned null body for {}, returning empty list", resourceName);
                return List.of();
            }

            log.info("Successfully fetched {} {} from external API", body.size(), resourceName);
            return body;

        } catch (HttpClientErrorException e) {
            log.error("Client error fetching {} from external API: {} - {}",
                    resourceName, e.getStatusCode(), e.getResponseBodyAsString());
            throw new ExternalApiException(
                    "External API client error for " + resourceName + ": " + e.getStatusCode(),
                    e.getStatusCode().value(),
                    e.getResponseBodyAsString());

        } catch (HttpServerErrorException e) {
            log.error("Server error fetching {} from external API: {} - {}",
                    resourceName, e.getStatusCode(), e.getResponseBodyAsString());
            throw new ExternalApiException(
                    "External API server error for " + resourceName + ": " + e.getStatusCode(),
                    e.getStatusCode().value(),
                    e.getResponseBodyAsString());

        } catch (ResourceAccessException e) {
            log.error("Timeout/connection error fetching {} from external API: {}",
                    resourceName, e.getMessage());
            throw new ExternalApiException(
                    "External API is unreachable for " + resourceName + ": " + e.getMessage(), e);
        }
    }
}
