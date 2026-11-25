package com.example.starter_project_2025.system.i18n;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.DefaultUriBuilderFactory;

import java.time.Duration;

@Configuration
@EnableConfigurationProperties(I18nProperties.class)
public class TranslationConfig {

    /**
     * RestTemplate riêng cho tầng dịch tự động.
     *
     * <p>Tách riêng vì thời gian chờ của dịch vụ dịch khác với các API ngoài khác
     * (timeout chung trong {@code external.api.*} chỉ 10 giây).
     *
     * <p>{@link DefaultUriBuilderFactory} với {@code VALUES_ONLY} đảm bảo phần giá trị của
     * query string được encode đúng một lần. Nếu dùng {@code UriComponentsBuilder.build()}
     * thì chuỗi chưa được encode, các ký tự như khoảng trắng, {@code &}, {@code [} hay dấu
     * tiếng Việt sẽ làm hỏng URI và dịch vụ trả về kết quả sai.
     */
    @Bean("translationRestTemplate")
    public RestTemplate translationRestTemplate(
            RestTemplateBuilder builder,
            I18nProperties properties
    ) {
        DefaultUriBuilderFactory uriFactory = new DefaultUriBuilderFactory();
        uriFactory.setEncodingMode(DefaultUriBuilderFactory.EncodingMode.VALUES_ONLY);

        return builder
                .uriTemplateHandler(uriFactory)
                .setConnectTimeout(Duration.ofMillis(Math.min(properties.getTimeoutMs(), 5_000)))
                .setReadTimeout(Duration.ofMillis(properties.getTimeoutMs()))
                .build();
    }
}
