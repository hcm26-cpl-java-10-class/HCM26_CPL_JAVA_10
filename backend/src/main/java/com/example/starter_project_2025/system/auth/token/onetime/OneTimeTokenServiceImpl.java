package com.example.starter_project_2025.system.auth.token.onetime;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.auth.util.TokenUtil;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class OneTimeTokenServiceImpl implements OneTimeTokenService {

    OneTimeTokenRepository oneTimeTokenRepository;

    @NonFinal
    @Value("${jwt.password-one-time-token.duration}")
    long oneTimeExpirationSeconds;

    @Override
    public String createOneTimeToken(User user, OneTimeToken.TokenType type) {
        String rawToken = UUID.randomUUID().toString();

        OneTimeToken token = OneTimeToken.builder()
                .tokenHash(TokenUtil.hash(rawToken))
                .user(user)
                .type(type)
                .expiryDate(Instant.now().plusSeconds(oneTimeExpirationSeconds))
                .used(false)
                .build();

        oneTimeTokenRepository.save(token);

        return rawToken;
    }

    @Override
    public OneTimeToken verifyOneTimeToken(String rawToken, OneTimeToken.TokenType type) {
        String hash = TokenUtil.hash(rawToken);

        OneTimeToken token = oneTimeTokenRepository
                .findByTokenHashAndType(hash, type)
                .orElseThrow(() -> new BadRequestException("Invalid token"));

        if (token.isUsed()) {
            throw new BadRequestException("Token already used");
        }

        if (token.getExpiryDate().isBefore(Instant.now())) {
            throw new BadRequestException("Token expired");
        }

        return token;
    }

    @Override
    public void markUsed(OneTimeToken token) {
        token.setUsed(true);
        oneTimeTokenRepository.save(token);
    }
}
