package com.example.starter_project_2025.system.git_integration.config;

import lombok.experimental.UtilityClass;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.interfaces.RSAPrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;

/**
 * Parses the GitHub App private key. GitHub issues PKCS#1 keys
 * ("BEGIN RSA PRIVATE KEY"), which the JDK cannot read directly, so they are
 * wrapped into PKCS#8 before decoding. PKCS#8 keys ("BEGIN PRIVATE KEY") are
 * accepted as-is. Error messages never include key material.
 */
@UtilityClass
public class GitHubPrivateKeyLoader {

    private static final String PKCS1_HEADER = "-----BEGIN RSA PRIVATE KEY-----";
    private static final String PKCS1_FOOTER = "-----END RSA PRIVATE KEY-----";
    private static final String PKCS8_HEADER = "-----BEGIN PRIVATE KEY-----";
    private static final String PKCS8_FOOTER = "-----END PRIVATE KEY-----";

    /** AlgorithmIdentifier SEQUENCE for rsaEncryption (1.2.840.113549.1.1.1) with NULL params. */
    private static final byte[] RSA_ALGORITHM_IDENTIFIER = {
            0x30, 0x0d, 0x06, 0x09, 0x2a, (byte) 0x86, 0x48, (byte) 0x86,
            (byte) 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00
    };

    public RSAPrivateKey load(GitHubAppProperties properties) {
        if (properties.getPrivateKeyPath() != null && !properties.getPrivateKeyPath().isBlank()) {
            return fromFile(Path.of(properties.getPrivateKeyPath().trim()));
        }
        return fromPem(properties.getPrivateKey());
    }

    public RSAPrivateKey fromFile(Path path) {
        try {
            return fromPem(Files.readString(path, StandardCharsets.US_ASCII));
        } catch (IOException e) {
            throw new IllegalStateException("Cannot read GitHub App private key file: " + path, e);
        }
    }

    public RSAPrivateKey fromPem(String pem) {
        if (pem == null || pem.isBlank()) {
            throw new IllegalStateException("GitHub App private key is empty");
        }
        // Allow single-line env values such as "-----BEGIN ...-----\nMIIE...\n-----END ...-----".
        String normalized = pem.replace("\\n", "\n").trim();
        try {
            byte[] pkcs8;
            if (normalized.contains(PKCS1_HEADER)) {
                pkcs8 = wrapPkcs1(decodeBody(normalized, PKCS1_HEADER, PKCS1_FOOTER));
            } else if (normalized.contains(PKCS8_HEADER)) {
                pkcs8 = decodeBody(normalized, PKCS8_HEADER, PKCS8_FOOTER);
            } else {
                throw new IllegalStateException("GitHub App private key must be a PEM RSA private key");
            }
            return (RSAPrivateKey) KeyFactory.getInstance("RSA")
                    .generatePrivate(new PKCS8EncodedKeySpec(pkcs8));
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalStateException("GitHub App private key is not a valid RSA key", e);
        }
    }

    private static byte[] decodeBody(String pem, String header, String footer) {
        int start = pem.indexOf(header) + header.length();
        int end = pem.indexOf(footer, start);
        if (end < 0) {
            throw new IllegalStateException("GitHub App private key PEM footer is missing");
        }
        String body = pem.substring(start, end).replaceAll("\\s", "");
        return Base64.getDecoder().decode(body);
    }

    /** PrivateKeyInfo ::= SEQUENCE { INTEGER 0, AlgorithmIdentifier, OCTET STRING pkcs1 } */
    private static byte[] wrapPkcs1(byte[] pkcs1) {
        ByteArrayOutputStream content = new ByteArrayOutputStream();
        content.writeBytes(new byte[]{0x02, 0x01, 0x00});
        content.writeBytes(RSA_ALGORITHM_IDENTIFIER);
        content.write(0x04);
        content.writeBytes(derLength(pkcs1.length));
        content.writeBytes(pkcs1);

        byte[] body = content.toByteArray();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(0x30);
        out.writeBytes(derLength(body.length));
        out.writeBytes(body);
        return out.toByteArray();
    }

    private static byte[] derLength(int length) {
        if (length < 0x80) {
            return new byte[]{(byte) length};
        }
        if (length <= 0xff) {
            return new byte[]{(byte) 0x81, (byte) length};
        }
        if (length <= 0xffff) {
            return new byte[]{(byte) 0x82, (byte) (length >> 8), (byte) length};
        }
        return new byte[]{(byte) 0x83, (byte) (length >> 16), (byte) (length >> 8), (byte) length};
    }
}
