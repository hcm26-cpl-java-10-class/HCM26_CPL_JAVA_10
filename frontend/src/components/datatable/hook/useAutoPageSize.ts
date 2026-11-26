import { useCallback, useEffect, useRef, useState } from "react";

interface UseAutoPageSizeOptions {

  headerHeight?: number;

  rowHeight?: number;

  minSize?: number;

  maxSize?: number;

  onSizeChange?: (size: number) => void;
}

export function useAutoPageSize(options: UseAutoPageSizeOptions = {}) {
  const {
    headerHeight = 41,
    rowHeight = 49,
    minSize = 5,
    maxSize = 50,
    onSizeChange,
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const [calculatedSize, setCalculatedSize] = useState<number>(10);
  const lastSizeRef = useRef<number>(10);

  const calculatePageSize = useCallback(() => {
    if (!containerRef.current) return;

    const containerHeight = containerRef.current.clientHeight;
    const availableHeight = containerHeight - headerHeight;

    let size = Math.floor(availableHeight / rowHeight);

    size = Math.max(minSize, Math.min(maxSize, size));

    if (size !== lastSizeRef.current) {
      lastSizeRef.current = size;
      setCalculatedSize(size);
      onSizeChange?.(size);
    }
  }, [headerHeight, rowHeight, minSize, maxSize, onSizeChange]);

  useEffect(() => {
    const timeoutId = setTimeout(calculatePageSize, 100);

    const resizeObserver = new ResizeObserver(() => {
      calculatePageSize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [calculatePageSize]);

  return {
    containerRef,
    calculatedSize,
    recalculate: calculatePageSize,
  };
}
