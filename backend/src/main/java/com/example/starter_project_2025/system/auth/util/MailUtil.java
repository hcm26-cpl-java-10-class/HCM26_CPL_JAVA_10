package com.example.starter_project_2025.system.auth.util;

import com.example.starter_project_2025.exception.BadRequestException;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class MailUtil {

    JavaMailSender mailSender;
    SpringTemplateEngine templateEngine;

    public String renderTemplate(
            String templateName,
            List<Map.Entry<String, Object>> contextVariables
    ) {
        Context context = new Context();
        if (contextVariables != null) {
            for (Map.Entry<String, Object> entry : contextVariables) {
                context.setVariable(entry.getKey(), entry.getValue());
            }
        }
        return templateEngine.process(templateName, context);
    }

    public void sendHtmlMail(String title, String from, String to, String htmlContent) {
        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");

            helper.setTo(to);
            helper.setSubject(title);
            helper.setText(htmlContent, true);
            helper.setFrom(from);

            mailSender.send(mimeMessage);
        } catch (MessagingException exception) {
            log.error("Failed to build/send mime message to {}: {}", to, exception.getMessage());
            throw new BadRequestException("Failed to send email to " + to);
        }
    }

    public void buildAndSendMail(
            String title,
            String from,
            String to,
            String templateName,
            List<Map.Entry<String, Object>> contextVariables
    ) {
        String htmlContent = renderTemplate(templateName, contextVariables);
        sendHtmlMail(title, from, to, htmlContent);
    }
}
