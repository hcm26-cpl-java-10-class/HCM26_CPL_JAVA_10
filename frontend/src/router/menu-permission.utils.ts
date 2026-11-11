/** These existing CRUD pages call MENU-protected APIs, even with legacy USER_READ menu metadata. */
export function resolveMenuPermission(url: string | undefined, declared: string | undefined) {
    return url === "/menus" || url === "/menu-groups" ? "MENU_READ" : declared;
}
