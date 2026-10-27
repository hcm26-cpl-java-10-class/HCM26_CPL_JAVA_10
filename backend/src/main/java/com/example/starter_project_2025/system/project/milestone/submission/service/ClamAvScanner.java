package com.example.starter_project_2025.system.project.milestone.submission.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;

@Component
public class ClamAvScanner {
    private final String host;
    private final int port;
    private final int timeoutMillis;

    public ClamAvScanner(
            @Value("${app.artifact.upload.clamav-host:}") String host,
            @Value("${app.artifact.upload.clamav-port:3310}") int port,
            @Value("${app.artifact.upload.clamav-timeout-millis:5000}") int timeoutMillis) {
        this.host = host == null ? "" : host.trim();
        this.port = port;
        this.timeoutMillis = timeoutMillis;
    }

    public void requireClean(byte[] bytes) {
        if (host.isBlank()) throw new ArtifactUploadUnavailableException("Malware scanner is not configured");
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), timeoutMillis);
            socket.setSoTimeout(timeoutMillis);
            DataOutputStream output = new DataOutputStream(socket.getOutputStream());
            output.write(new byte[]{'z', 'I', 'N', 'S', 'T', 'R', 'E', 'A', 'M', 0});
            int offset = 0;
            while (offset < bytes.length) {
                int length = Math.min(8192, bytes.length - offset);
                output.writeInt(length);
                output.write(bytes, offset, length);
                offset += length;
            }
            output.writeInt(0);
            output.flush();
            ByteArrayOutputStream response = new ByteArrayOutputStream();
            int value;
            while ((value = socket.getInputStream().read()) != -1 && value != 0) {
                if (response.size() >= 2048) throw new ArtifactUploadUnavailableException("Scanner returned an invalid response");
                response.write(value);
            }
            String result = response.toString(java.nio.charset.StandardCharsets.UTF_8).trim();
            if (result.endsWith("OK")) return;
            if (result.endsWith("FOUND")) throw new ArtifactUploadRejectedException("The file was rejected by the malware scanner");
            throw new ArtifactUploadUnavailableException("Malware scanner did not complete the scan: " + result);
        } catch (ArtifactUploadRejectedException | ArtifactUploadUnavailableException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ArtifactUploadUnavailableException("Malware scanner is unavailable", ex);
        }
    }

    public boolean isConfigured() { return !host.isBlank(); }
}
