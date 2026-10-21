package com.example.starter_project_2025;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@EnableAsync(proxyTargetClass = true)
@SpringBootApplication

	public static void main(String[] args) {
		SpringApplication.run(StarterProject2025Application.class, args);
	}

}
