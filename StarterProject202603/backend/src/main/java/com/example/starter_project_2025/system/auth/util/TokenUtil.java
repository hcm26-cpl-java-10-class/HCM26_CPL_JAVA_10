package com.example.starter_project_2025.system.auth.util;

import lombok.experimental.UtilityClass;
import org.apache.commons.codec.digest.DigestUtils;

@UtilityClass
public class TokenUtil {

    public String hash(String rawToken) {
        return DigestUtils.sha256Hex(rawToken);
    }
}
