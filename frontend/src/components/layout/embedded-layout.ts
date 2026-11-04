import { createContext } from "react";

/**
 * True when a page is rendered inside another page's layout (for example the exam tabs),
 * so MainLayout must not draw the sidebar and header a second time.
 */
export const EmbeddedLayoutContext = createContext(false);
