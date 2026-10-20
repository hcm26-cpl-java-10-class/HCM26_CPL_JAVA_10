import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronRight, MapPin, Folder, Loader2 } from 'lucide-react';
import type { LocationNode, LocationTreeProps } from '@/types';
import { locationApi } from '@/api';

export const LocationTree: React.FC<LocationTreeProps> = ({
  onSelectLocation,
  selectedLocationId,
}) => {
  const [treeData, setTreeData] = useState<LocationNode[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});

  const loadTreeData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await locationApi.getLocationTree();
      setTreeData(data ?? []);
    } catch (error) {
      console.error('Failed to load location tree:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTreeData();
  }, [loadTreeData]);

  const toggleExpand = useCallback((id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  const handleSelect = useCallback(
    (node: LocationNode) => {
      if (onSelectLocation) {
        onSelectLocation(node);
      }
    },
    [onSelectLocation]
  );

  const renderTreeNode = useCallback(
    (node: LocationNode) => {
      const hasChildren = Boolean(node.children && node.children.length > 0);
      const isExpanded = Boolean(expandedIds[node.id]);
      const isSelected = selectedLocationId === node.id;

      return (
        <div key={node.id} className="select-none">
          <div
            className={`group flex items-center gap-1.5 px-2.5 py-1.5 my-0.5 rounded-md text-sm transition-all cursor-pointer ${
              isSelected
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
            onClick={() => handleSelect(node)}
          >
            {/* Toggle Button */}
            <button
              type="button"
              className={`p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-transform ${
                !hasChildren ? 'invisible' : ''
              }`}
              onClick={(e) => toggleExpand(node.id, e)}
            >
              {isExpanded ? (
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              )}
            </button>

            {/* Icon đại diện chuẩn Lucide */}
            {hasChildren ? (
              <Folder className="size-4 shrink-0 text-sky-500" />
            ) : (
              <MapPin className="size-4 shrink-0 text-emerald-500" />
            )}

            {/* Title & Code */}
            <span className="truncate">{node.name}</span>
            <span className="text-xs text-muted-foreground/70 font-mono">
              ({node.code})
            </span>
          </div>

          {/* Children List */}
          {hasChildren && isExpanded && (
            <div className="pl-4 ml-3 border-l border-border/60">
              {node.children!.map((child) => renderTreeNode(child))}
            </div>
          )}
        </div>
      );
    },
    [expandedIds, selectedLocationId, handleSelect, toggleExpand]
  );

  const treeContent = useMemo(() => {
    if (loading) {
      return (
        <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>Đang tải sơ đồ địa điểm...</span>
        </div>
      );
    }

    if (treeData.length === 0) {
      return (
        <div className="p-4 text-center text-sm text-muted-foreground">
          Chưa có dữ liệu địa điểm
        </div>
      );
    }

    return treeData.map((node) => renderTreeNode(node));
  }, [loading, treeData, renderTreeNode]);

  return (
    <div className="w-full rounded-lg border bg-card text-card-foreground shadow-sm p-3">
      <div className="flex items-center justify-between pb-2 mb-2 border-b">
        <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <MapPin className="size-4 text-primary" />
          <span>Sơ đồ Địa điểm</span>
        </h3>
      </div>
      <div className="overflow-y-auto max-h-[600px] pr-1">{treeContent}</div>
    </div>
  );
};