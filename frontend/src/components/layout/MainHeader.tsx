import { iconMap } from "@/components/datatable/iconMap";
import { useLocation } from "react-router-dom";
import { useActiveModuleGroups } from "@/hooks/useSidebarMenus";
import { useMemo } from "react";

export default function MainHeader({
                                       title,

                                   }: {
    title?: string;

}) {
    const { data: moduleGroups } = useActiveModuleGroups();
    const location = useLocation();

    const activeModule = moduleGroups
        ?.flatMap(group => group.modules)
        ?.find(module => module.url === location.pathname);

    const iconKey: keyof typeof iconMap =
        activeModule?.icon && activeModule.icon in iconMap
            ? (activeModule.icon as keyof typeof iconMap)
            : "menu";

    const Icon = useMemo(() => iconMap[iconKey], [iconKey]);

    if (!Icon) return null;

    const resolvedTitle = title ?? activeModule?.name ?? "";

    return (
        <div className="flex flex-col">
            <div className="flex gap-2 items-center">
                <Icon className="text-gray-600" />
                <h1 className="text-xl font-bold">{resolvedTitle}</h1>
            </div>
        </div>
    );
}
