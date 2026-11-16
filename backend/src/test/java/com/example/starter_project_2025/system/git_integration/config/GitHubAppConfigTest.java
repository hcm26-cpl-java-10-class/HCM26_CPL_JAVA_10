package com.example.starter_project_2025.system.git_integration.config;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.math.BigInteger;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateCrtKey;
import java.security.interfaces.RSAPrivateKey;
import java.util.Arrays;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GitHubAppConfigTest {

    private static RSAPrivateCrtKey generatedKey;

    @BeforeAll
    static void generateKey() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        KeyPair pair = generator.generateKeyPair();
        generatedKey = (RSAPrivateCrtKey) pair.getPrivate();
    }

    @Test
    void loadsPkcs8PemKey() {
        RSAPrivateKey key = GitHubPrivateKeyLoader.fromPem(pem("PRIVATE KEY", generatedKey.getEncoded()));

        assertThat(key.getModulus()).isEqualTo(generatedKey.getModulus());
        assertThat(key.getPrivateExponent()).isEqualTo(generatedKey.getPrivateExponent());
    }

    @Test
    void loadsPkcs1PemKeyAsIssuedByGitHub(@TempDir Path dir) throws Exception {
        Path file = dir.resolve("github-app.private-key.pem");
        Files.writeString(file, pem("RSA PRIVATE KEY", toPkcs1(generatedKey)));

        RSAPrivateKey key = GitHubPrivateKeyLoader.fromFile(file);

        assertThat(key.getModulus()).isEqualTo(generatedKey.getModulus());
        assertThat(key.getPrivateExponent()).isEqualTo(generatedKey.getPrivateExponent());
    }

    @Test
    void acceptsSingleLineEnvValueWithEscapedNewlines() {
        String singleLine = pem("RSA PRIVATE KEY", toPkcs1(generatedKey)).replace("\n", "\\n");

        RSAPrivateKey key = GitHubPrivateKeyLoader.fromPem(singleLine);

        assertThat(key.getModulus()).isEqualTo(generatedKey.getModulus());
    }

    @Test
    void rejectsNonPemValueWithoutEchoingIt() {
        assertThatThrownBy(() -> GitHubPrivateKeyLoader.fromPem("super-secret-value"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageNotContaining("super-secret-value");
    }

    @Test
    void disabledIntegrationStartsWithoutSettings() {
        GitHubAppCredentials credentials = new GitHubAppCredentials(new GitHubAppProperties());

        assertThat(credentials.isEnabled()).isFalse();
        assertThatThrownBy(credentials::privateKey).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void enabledIntegrationFailsFastWhenSettingsAreMissing() {
        GitHubAppProperties properties = new GitHubAppProperties();
        properties.setEnabled(true);
        properties.setAppId("123");

        assertThatThrownBy(() -> new GitHubAppCredentials(properties))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("app.github.app-slug")
                .hasMessageContaining("app.github.client-secret")
                .hasMessageContaining("app.github.private-key-path");
    }

    @Test
    void enabledIntegrationLoadsKeyAndHidesSecretsFromToString() {
        GitHubAppProperties properties = new GitHubAppProperties();
        properties.setEnabled(true);
        properties.setAppId("123");
        properties.setAppSlug("fams-git");
        properties.setClientId("Iv1.client");
        properties.setClientSecret("client-secret-value");
        properties.setWebhookSecret("webhook-secret-value");
        properties.setCallbackUrl("http://localhost:5173/git-integration/github/callback");
        properties.setPrivateKey(pem("RSA PRIVATE KEY", toPkcs1(generatedKey)));

        GitHubAppCredentials credentials = new GitHubAppCredentials(properties);

        assertThat(credentials.privateKey().getModulus()).isEqualTo(generatedKey.getModulus());
        assertThat(properties.installUrl()).isEqualTo("https://github.com/apps/fams-git/installations/new");
        assertThat(properties.toString())
                .doesNotContain("client-secret-value")
                .doesNotContain("webhook-secret-value")
                .doesNotContain("PRIVATE KEY");
    }

    private static String pem(String type, byte[] der) {
        String body = Base64.getMimeEncoder(64, "\n".getBytes()).encodeToString(der);
        return "-----BEGIN " + type + "-----\n" + body + "\n-----END " + type + "-----\n";
    }

    /** Extracts the PKCS#1 RSAPrivateKey from the PKCS#8 encoding (the trailing OCTET STRING). */
    private static byte[] toPkcs1(RSAPrivateCrtKey key) {
        byte[] pkcs8 = key.getEncoded();
        int modulusLength = key.getModulus().toByteArray().length;
        // PKCS#1 starts with SEQUENCE tag 0x30 right after the OCTET STRING header near offset 22-26.
        for (int i = 20; i < 32; i++) {
            if (pkcs8[i] == 0x04 && pkcs8[i + 1] == (byte) 0x82 && pkcs8[i + 4] == 0x30) {
                byte[] pkcs1 = Arrays.copyOfRange(pkcs8, i + 4, pkcs8.length);
                assertThat(pkcs1.length).isGreaterThan(modulusLength);
                return pkcs1;
            }
        }
        throw new IllegalStateException("Unexpected PKCS#8 layout: " + new BigInteger(1, pkcs8).bitLength());
    }
}
