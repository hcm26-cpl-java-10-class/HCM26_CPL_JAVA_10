import {
    Breadcrumb,
    BreadcrumbEllipsis,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb.tsx";
import { GraduationCap, Home } from "lucide-react";
import { Fragment, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useActiveModuleGroups } from "@/hooks/useSidebarMenus.ts";
import { iconMap } from "@/components/datatable/iconMap";

type Props = {
    pathTitles?: Record<string, string>;
    hasPage?: boolean;
    ignorePaths?: string[];
    variant?: "default" | "student";
    plain?: boolean;
};

type BreadcrumbNode = {
    segment: string;
    href: string;
    title: string;
    isLast: boolean;
};

function formatPath(path: string) {
    return path
        .replace(/-/g, " ")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizePath(path?: string | null) {
    if (!path) {
        return "";
    }

    return path.replace(/\/+$/, "");
}

function isLikelyIdentifier(segment: string) {
    const numericPattern = /^\d+$/;
    const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const tokenLikePattern = /^[A-Za-z0-9_-]{16,}$/;

    return numericPattern.test(segment) || uuidPattern.test(segment) || tokenLikePattern.test(segment);
}

function resolveTitle(
    segment: string,
    href: string,
    pathTitles?: Record<string, string>,
    moduleTitleByPath?: Map<string, string>,
) {
    const normalizedHref = normalizePath(href);

    return (
        pathTitles?.[segment] ||
        pathTitles?.[href] ||
        moduleTitleByPath?.get(normalizedHref) ||
        formatPath(segment)
    );
}

export default function DynamicBreadcrumbs({
    pathTitles,
    hasPage = true,
    ignorePaths = [],
    variant = "default",
    plain = false,
}: Props) {
    const location = useLocation();
    const { data: moduleGroups } = useActiveModuleGroups();
    const isStudentVariant = variant === "student";

    const homePath = isStudentVariant ? "/student" : "/";
    const homeLabel = isStudentVariant ? "Student Home" : "Home";
    const HomeIcon = isStudentVariant ? GraduationCap : Home;

    const modules = useMemo(() => moduleGroups?.flatMap((group) => group.modules) ?? [], [moduleGroups]);

    const moduleTitleByPath = useMemo(() => {
        const mapping = new Map<string, string>();

        for (const module of modules) {
            const normalizedModulePath = normalizePath(module.url);

            if (!normalizedModulePath) {
                continue;
            }

            const fallbackTitle = formatPath(normalizedModulePath.split("/").pop() || "");
            mapping.set(normalizedModulePath, module.title || module.name || fallbackTitle);
        }

        return mapping;
    }, [modules]);

    const ignoredPaths = new Set(ignorePaths.map((segment) => segment.toLowerCase()));
    const pathnameSegments = location.pathname
        .split("/")
        .filter(Boolean)
        .filter((segment) => !ignoredPaths.has(segment.toLowerCase()));

    const rawSegments =
        isStudentVariant && pathnameSegments[0]?.toLowerCase() === "student"
            ? pathnameSegments.slice(1)
            : pathnameSegments;

    const crumbs: BreadcrumbNode[] = rawSegments.flatMap((segment, index) => {
        const href = `/${rawSegments.slice(0, index + 1).join("/")}`;
        const title = resolveTitle(segment, href, pathTitles, moduleTitleByPath);
        const hasCustomTitle = Boolean(pathTitles?.[segment] || pathTitles?.[href]);

        if (!hasCustomTitle && isLikelyIdentifier(segment)) {
            return [];
        }

        return [
            {
                segment,
                href,
                title,
                isLast: index === rawSegments.length - 1,
            },
        ];
    });

    const currentPath = normalizePath(location.pathname) || "/";
    const normalizedHomePath = normalizePath(homePath) || "/";
    const isAtHome = currentPath === normalizedHomePath;

    if (!crumbs.length && !isStudentVariant) {
        return null;
    }

    const activeModule =
        modules.find((module) => normalizePath(module.url) === currentPath) ||
        modules.find((module) => {
            const modulePath = normalizePath(module.url);

            if (!modulePath) {
                return false;
            }

            return currentPath.startsWith(`${modulePath}/`);
        });

    const iconKey: keyof typeof iconMap =
        activeModule?.icon && activeModule.icon in iconMap
            ? (activeModule.icon as keyof typeof iconMap)
            : "menu";

    const ActiveIcon = iconMap[iconKey] || HomeIcon;
    const maxVisibleCrumbs = isStudentVariant ? 2 : 3;
    const shouldCollapse = crumbs.length > maxVisibleCrumbs;
    const displayNodes = shouldCollapse
        ? isStudentVariant
            ? [
                  { type: "crumb" as const, crumb: crumbs[0] },
                  { type: "ellipsis" as const },
                  { type: "crumb" as const, crumb: crumbs[crumbs.length - 1] },
              ]
            : [
                  { type: "crumb" as const, crumb: crumbs[0] },
                  { type: "ellipsis" as const },
                  ...crumbs.slice(-2).map((crumb) => ({ type: "crumb" as const, crumb })),
              ]
        : crumbs.map((crumb) => ({ type: "crumb" as const, crumb }));

    const showHomeAsPage = isAtHome && displayNodes.length === 0;

    return (
        <Breadcrumb className="min-w-0">
            <BreadcrumbList className="min-w-0">
                <BreadcrumbItem>
                    {showHomeAsPage ? (
                        <BreadcrumbPage className={plain ? "text-foreground" : "inline-flex max-w-[50vw] items-center gap-1.5 truncate rounded-md bg-accent px-2.5 py-1 font-semibold"}>
                            {!plain && <HomeIcon className="size-3.5 shrink-0 text-muted-foreground" />}
                            <span className={plain ? undefined : "truncate"}>{homeLabel}</span>
                        </BreadcrumbPage>
                    ) : (
                        <BreadcrumbLink
                            asChild
                            className={plain ? "text-muted-foreground hover:text-foreground" : "inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground hover:bg-accent"}
                        >
                            <Link to={homePath}>
                                {!plain && <HomeIcon className="size-3.5" />}
                                {homeLabel}
                            </Link>
                        </BreadcrumbLink>
                    )}
                </BreadcrumbItem>

                {displayNodes.length > 0 && <BreadcrumbSeparator />}

                {displayNodes.map((node, index) => {
                    const isLastNode = index === displayNodes.length - 1;
                    const nodeKey = node.type === "crumb" ? node.crumb.href : `ellipsis-${index}`;

                    return (
                        <Fragment key={nodeKey}>
                            <BreadcrumbItem>
                                {node.type === "ellipsis" ? (
                                    <BreadcrumbEllipsis className="size-7" />
                                ) : node.crumb.isLast || !hasPage ? (
                                    <BreadcrumbPage className={plain ? "text-foreground font-normal" : "inline-flex max-w-[44vw] items-center gap-1.5 truncate rounded-md bg-accent px-2.5 py-1 font-semibold"}>
                                        {!plain && <ActiveIcon className="size-3.5 shrink-0 text-muted-foreground" />}
                                        <span className={plain ? undefined : "truncate"}>{node.crumb.title}</span>
                                    </BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink
                                        asChild
                                        className="inline-flex max-w-[24vw] items-center truncate rounded-md px-2 py-1 text-muted-foreground hover:bg-accent"
                                    >
                                        <Link to={node.crumb.href} className="truncate">
                                            {node.crumb.title}
                                        </Link>
                                    </BreadcrumbLink>
                                )}
                            </BreadcrumbItem>

                            {!isLastNode && <BreadcrumbSeparator />}
                        </Fragment>
                    );
                })}
            </BreadcrumbList>
        </Breadcrumb>
    );
}
