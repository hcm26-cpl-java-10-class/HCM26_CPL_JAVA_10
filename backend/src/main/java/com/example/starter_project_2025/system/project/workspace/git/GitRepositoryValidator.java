package com.example.starter_project_2025.system.project.workspace.git;

import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/** Pure validation/mapping: never executes Git, resolves DNS or fetches a URL. */
@Component
public class GitRepositoryValidator {
    public static final String INVALID_URL = "Đường dẫn Git Repository không hợp lệ. Vui lòng nhập đúng định dạng URL Git (HTTPS/SSH)";
    private static final Pattern SCP = Pattern.compile("git@([A-Za-z0-9.-]+):(.+)");
    public record Repository(String cloneUrl, String webUrl, String provider, String branch) { }

    public Repository validate(GitConfigDtos.Save input) {
        String raw = input.repositoryUrl() == null ? "" : input.repositoryUrl().trim();
        if (raw.isEmpty() || raw.length() > 2048 || raw.chars().anyMatch(c -> Character.isWhitespace(c) || Character.isISOControl(c)))
            throw invalid();
        boolean ssh;
        String host, path, cloneUrl;
        int port = -1;
        var scp = SCP.matcher(raw);
        try {
            if (scp.matches()) {
                ssh = true; host = scp.group(1).toLowerCase(Locale.ROOT); path = scp.group(2);
                // Parse the path as a URI too, rejecting queries/fragments and malformed escapes.
                URI value = new URI("ssh://git@" + host + "/" + path);
                if (value.getRawQuery() != null || value.getRawFragment() != null) throw invalid();
                cloneUrl = "git@" + host + ":" + path;
            } else {
                URI value = new URI(raw);
                ssh = "ssh".equalsIgnoreCase(value.getScheme());
                if (!ssh && !"https".equalsIgnoreCase(value.getScheme())) throw invalid();
                if (value.getHost() == null || value.getRawQuery() != null || value.getRawFragment() != null
                        || (ssh ? !"git".equals(value.getUserInfo()) : value.getRawUserInfo() != null)) throw invalid();
                host = value.getHost().toLowerCase(Locale.ROOT); port = value.getPort();
                if (port != -1 && (port < 1 || port > 65535)) throw invalid();
                path = value.getRawPath();
                cloneUrl = (ssh ? "ssh://git@" : "https://") + host + (port == -1 ? "" : ":" + port) + path;
            }
            if (!host.matches("(?=.{1,253}$)[a-z0-9]+(?:[.-][a-z0-9]+)*") || !host.contains(".")) throw invalid();
            path = path.replaceFirst("^/", "").replaceFirst("/$", "");
            String decoded = new URI("https://" + host + "/" + path).getPath().substring(1);
            List<String> segments = Arrays.asList(decoded.split("/", -1));
            if (segments.size() < 2 || segments.stream().anyMatch(s -> s.equals(".") || s.equals("..")
                    || s.startsWith(".") || s.endsWith(".") || !s.matches("[\\p{L}\\p{N} _~.+-]+"))) throw invalid();
            String provider;
            String web;
            String webPath = path.replaceFirst("\\.git$", "");
            if (host.equals("github.com") || host.equals("bitbucket.org")) {
                if (segments.size() != 2 || port != -1) throw invalid();
                provider = host.equals("github.com") ? "GITHUB" : "BITBUCKET";
                web = "https://" + host + "/" + webPath;
            } else if (host.equals("gitlab.com")) {
                if (port != -1 || segments.contains("-")) throw invalid();
                provider = "GITLAB"; web = "https://" + host + "/" + webPath;
            } else if (host.equals("ssh.dev.azure.com")) {
                if (!ssh || port != -1 || segments.size() != 4 || !segments.getFirst().equals("v3")) throw invalid();
                String[] parts = webPath.split("/");
                provider = "AZURE_DEVOPS"; web = "https://dev.azure.com/" + parts[1] + "/" + parts[2] + "/_git/" + parts[3];
            } else if (host.equals("dev.azure.com") || host.endsWith(".visualstudio.com")) {
                if (ssh || port != -1 || segments.size() != (host.equals("dev.azure.com") ? 4 : 3)
                        || !segments.get(segments.size() - 2).equals("_git")) throw invalid();
                provider = "AZURE_DEVOPS"; web = "https://" + host + "/" + webPath;
            } else {
                provider = "SELF_HOSTED";
                if (!ssh && !path.endsWith(".git")) throw invalid();
                // SSH aliases/ports do not identify the web server. Ask explicitly.
                if (ssh) {
                    web = safeWebUrl(input.repositoryWebUrl());
                    if (web == null) throw new GitConfigValidationException("repositoryWebUrl", "Provide the HTTPS repository page for this self-hosted SSH URL.");
                } else web = "https://" + host + (port == -1 ? "" : ":" + port) + "/" + webPath;
            }
            return new Repository(cloneUrl, web, provider, branch(input.defaultBranch()));
        } catch (GitConfigValidationException ex) { throw ex; }
        catch (Exception ex) { throw invalid(); }
    }

    private String safeWebUrl(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            if (raw.length() > 2048 || raw.chars().anyMatch(c -> Character.isWhitespace(c) || Character.isISOControl(c))) throw invalid();
            URI url = new URI(raw.trim());
            if (!"https".equalsIgnoreCase(url.getScheme()) || url.getHost() == null || url.getRawUserInfo() != null
                    || (url.getPort() != -1 && (url.getPort() < 1 || url.getPort() > 65535))
                    || url.getRawQuery() != null || url.getRawFragment() != null || url.getPath() == null || url.getPath().length() < 2)
                throw invalid();
            return url.toASCIIString();
        } catch (Exception ex) { throw new GitConfigValidationException("repositoryWebUrl", "Use an HTTPS repository page without credentials, query or fragment."); }
    }

    String branch(String raw) {
        String name = raw == null ? "" : raw.trim();
        if (name.isEmpty() || name.length() > 255 || name.equals("@") || name.startsWith("-") || name.startsWith("/")
                || name.endsWith("/") || name.endsWith(".") || name.contains("..") || name.contains("@{") || name.contains("//")
                || name.chars().anyMatch(c -> Character.isWhitespace(c) || Character.isISOControl(c) || "~^:?*[\\".indexOf(c) >= 0)
                || Arrays.stream(name.split("/")).anyMatch(p -> p.startsWith(".") || p.endsWith(".lock")))
            throw new GitConfigValidationException("defaultBranch", "Enter a valid Git branch name, for example main or feature/login.");
        return name;
    }
    private GitConfigValidationException invalid() { return new GitConfigValidationException("repositoryUrl", INVALID_URL); }
}
