package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiClient;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import com.example.starter_project_2025.system.git_integration.github.InstallationTokenProvider;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallationRepositoriesPage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallationToken;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class InstallationRepositoryCacheTest {

    private static final long INSTALLATION = 77L;

    private MutableClock clock;
    private GitHubApiClient github;
    private InstallationRepositoryCache cache;

    @BeforeEach
    void setUp() {
        clock = new MutableClock(Instant.parse("2026-11-16T10:00:00Z"));
        github = mock(GitHubApiClient.class);
        when(github.createInstallationToken(anyLong()))
                .thenAnswer(invocation -> new GitHubInstallationToken("ghs_token", clock.instant().plus(Duration.ofHours(1))));
        when(github.listInstallationRepositories(anyString(), eq(1))).thenReturn(page(2, repo(1), repo(2)));
        GitHubAppProperties properties = new GitHubAppProperties();
        properties.setRepositoryCacheTtlSeconds(300);
        properties.setRepositoryMaxPages(10);
        cache = new InstallationRepositoryCache(github, new InstallationTokenProvider(github, clock), properties, clock);
    }

    @Test
    void servesFromCacheWithinTtlAndRefetchesAfterExpiry() {
        assertThat(cache.get(INSTALLATION, false).fromCache()).isFalse();
        clock.advance(Duration.ofMinutes(4));
        var second = cache.get(INSTALLATION, false);
        assertThat(second.fromCache()).isTrue();
        assertThat(second.snapshot().repositories()).hasSize(2);
        verify(github, times(1)).listInstallationRepositories(anyString(), anyInt());

        clock.advance(Duration.ofMinutes(2));
        assertThat(cache.get(INSTALLATION, false).fromCache()).isFalse();
        verify(github, times(2)).listInstallationRepositories(anyString(), anyInt());
    }

    @Test
    void reusesInstallationTokenUntilCloseToExpiry() {
        cache.get(INSTALLATION, false);
        clock.advance(Duration.ofMinutes(6));
        cache.get(INSTALLATION, false);
        verify(github, times(1)).createInstallationToken(INSTALLATION);

        clock.advance(Duration.ofMinutes(50)); // token now expires in < 5 minutes
        cache.get(INSTALLATION, false);
        verify(github, times(2)).createInstallationToken(INSTALLATION);
    }

    @Test
    void forcedRefreshBypassesCacheButIsThrottled() {
        cache.get(INSTALLATION, false);
        assertThat(cache.get(INSTALLATION, true).fromCache()).isFalse();
        assertThat(cache.get(INSTALLATION, true).fromCache()).isTrue(); // within 10 s of the last forced refresh
        clock.advance(Duration.ofSeconds(11));
        assertThat(cache.get(INSTALLATION, true).fromCache()).isFalse();
        verify(github, times(3)).listInstallationRepositories(anyString(), anyInt());
    }

    @Test
    void walksAllPagesUntilTotalCount() {
        List<GitHubRepository> first = IntStream.rangeClosed(1, 100).mapToObj(InstallationRepositoryCacheTest::repo).toList();
        when(github.listInstallationRepositories(anyString(), eq(1))).thenReturn(new GitHubInstallationRepositoriesPage(101, first));
        when(github.listInstallationRepositories(anyString(), eq(2))).thenReturn(page(101, repo(101)));

        var snapshot = cache.get(INSTALLATION, false).snapshot();
        assertThat(snapshot.repositories()).hasSize(101);
        assertThat(snapshot.truncated()).isFalse();
    }

    @Test
    void stopsAtMaxPagesAndFlagsTruncation() {
        GitHubAppProperties properties = new GitHubAppProperties();
        properties.setRepositoryMaxPages(1);
        cache = new InstallationRepositoryCache(github, new InstallationTokenProvider(github, clock), properties, clock);
        when(github.listInstallationRepositories(anyString(), eq(1))).thenReturn(page(500, repo(1)));

        assertThat(cache.get(INSTALLATION, false).snapshot().truncated()).isTrue();
    }

    @Test
    void failuresAreNotCachedAndDropStaleData() {
        cache.get(INSTALLATION, false);
        clock.advance(Duration.ofMinutes(6));
        when(github.listInstallationRepositories(anyString(), eq(1)))
                .thenThrow(new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, "list", 502))
                .thenReturn(page(1, repo(9)));

        assertThatThrownBy(() -> cache.get(INSTALLATION, false)).isInstanceOf(GitHubApiException.class);
        var recovered = cache.get(INSTALLATION, false);
        assertThat(recovered.fromCache()).isFalse();
        assertThat(recovered.snapshot().repositories()).extracting(GitHubRepository::id).containsExactly(9L);
    }

    @Test
    void concurrentRequestsShareOneGitHubFetch() throws Exception {
        CountDownLatch release = new CountDownLatch(1);
        AtomicInteger calls = new AtomicInteger();
        when(github.listInstallationRepositories(anyString(), eq(1))).thenAnswer(invocation -> {
            calls.incrementAndGet();
            release.await(5, TimeUnit.SECONDS);
            return page(1, repo(1));
        });

        ExecutorService pool = Executors.newFixedThreadPool(4);
        try {
            List<Future<InstallationRepositoryCache.Result>> futures = IntStream.range(0, 4)
                    .mapToObj(i -> pool.submit(() -> cache.get(INSTALLATION, false))).toList();
            Thread.sleep(200);
            release.countDown();
            for (Future<InstallationRepositoryCache.Result> future : futures) {
                assertThat(future.get(5, TimeUnit.SECONDS).snapshot().repositories()).hasSize(1);
            }
        } finally {
            pool.shutdownNow();
        }
        assertThat(calls.get()).isEqualTo(1);
    }

    private static GitHubRepository repo(long id) {
        return new GitHubRepository(id, "repo-" + id, "org/repo-" + id, new GitHubRepository.Owner("org"),
                "https://github.com/org/repo-" + id, true, "private", "main", false, false);
    }

    private static GitHubInstallationRepositoriesPage page(int total, GitHubRepository... repositories) {
        return new GitHubInstallationRepositoriesPage(total, List.of(repositories));
    }

    /** Test clock that can be moved forward. */
    private static final class MutableClock extends Clock {
        private Instant now;

        MutableClock(Instant start) {
            this.now = start;
        }

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
