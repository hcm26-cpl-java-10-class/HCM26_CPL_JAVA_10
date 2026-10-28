package com.example.starter_project_2025.system.external_api;

import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ExternalApiProfileTest {
    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withBean(RestTemplate.class, () -> mock(RestTemplate.class))
            .withBean(ManagedTeachingClassRepository.class, () -> mock(ManagedTeachingClassRepository.class))
            .withBean(ManagedTeachingTrainerRepository.class, () -> mock(ManagedTeachingTrainerRepository.class))
            .withPropertyValues("external.api.base-url=http://localhost:9090")
            .withUserConfiguration(ExternalApiServiceImpl.class, LocalExternalApiService.class, ManagedClassDirectory.class, ManagedTrainerDirectory.class);

    @Test
    void defaultProfileKeepsRemoteServiceAndDoesNotSubstituteSampleDataOnFailure() {
        contextRunner.run(context -> {
            assertThat(context).hasSingleBean(ExternalApiService.class);
            ExternalApiService service = context.getBean(ExternalApiService.class);
            assertThat(service).isInstanceOf(ExternalApiServiceImpl.class);
            assertThat(service.isSampleData()).isFalse();
            RestTemplate client = context.getBean(RestTemplate.class);
            when(client.exchange(anyString(), any(), any(),
                    any(org.springframework.core.ParameterizedTypeReference.class)))
                    .thenThrow(new ResourceAccessException("Connection refused"));
            assertThatThrownBy(() -> service.fetchClasses("active")).isInstanceOf(ExternalApiException.class);
        });
    }

    @Test
    void localProfileProvidesFilteredConsistentSampleDataWithoutRemoteRequests() {
        contextRunner.withInitializer(context -> context.getEnvironment().setActiveProfiles("local"))
                .run(context -> {
                    assertThat(context).hasSingleBean(ExternalApiService.class);
                    ExternalApiService service = context.getBean(ExternalApiService.class);
                    assertThat(service).isInstanceOf(LocalExternalApiService.class);
                    assertThat(service.isSampleData()).isTrue();
                    assertThat(service.fetchClasses("ACTIVE")).hasSize(2)
                            .allSatisfy(item -> {
                                assertThat(item.getStatus()).isEqualTo("active");
                                assertThat(service.fetchClassById(item.getId()).getCode()).isEqualTo(item.getCode());
                            });
                    assertThat(service.fetchClasses(null)).hasSize(3);
                    assertThat(service.fetchTrainers("active")).hasSize(2);
                    assertThat(service.fetchTrainers(null)).hasSize(3);
                    assertThat(service.fetchRooms()).hasSize(2);
                    assertThatThrownBy(() -> service.fetchClassById(999L))
                            .isInstanceOfSatisfying(ExternalApiException.class,
                                    error -> assertThat(error.getStatusCode()).isEqualTo(404));
                    verifyNoInteractions(context.getBean(RestTemplate.class));
                });
    }
}
