export const getUserAvatarInitials = (name: string, fallback = "") => {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
        return `${words[0].charAt(0)}${words[words.length - 1].charAt(0)}`.toLocaleUpperCase("vi");
    }

    if (words.length === 1) {
        return words[0].slice(0, 2).toLocaleUpperCase("vi");
    }

    return fallback.trim().charAt(0).toLocaleUpperCase("vi") || "U";
};
