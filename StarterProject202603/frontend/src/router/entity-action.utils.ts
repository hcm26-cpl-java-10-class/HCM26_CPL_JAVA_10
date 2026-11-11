const PARAM_PATTERN = /:([A-Za-z0-9_]+)/g;

export function normalizeEntityActionPath(entityPath: string, actionPath: string): string {
    const basePath = entityPath.replace(/\/+$/, "");
    const trimmedActionPath = actionPath.trim();

    if (!trimmedActionPath) {
        return basePath || "/";
    }

    if (trimmedActionPath.startsWith("/")) {
        return trimmedActionPath;
    }

    return `${basePath}/${trimmedActionPath}`.replace(/\/+/g, "/");
}

export function resolveEntityActionPath(
    pathTemplate: string,
    row: Record<string, any> | null | undefined,
    idField: string,
): string | null {
    if (!row) {
        return pathTemplate;
    }

    let hasMissingParam = false;

    const resolved = pathTemplate.replace(PARAM_PATTERN, (_match, paramName: string) => {
        const rawValue = row[paramName] ?? row[idField];

        if (rawValue === undefined || rawValue === null || rawValue === "") {
            hasMissingParam = true;
            return "";
        }

        return encodeURIComponent(String(rawValue));
    });

    if (hasMissingParam) {
        return null;
    }

    return resolved;
}
