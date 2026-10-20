import { useCallback, useEffect, useRef, useState } from "react";

interface UseAutoPageSizeOptions {
  /** Height of table header in pixels. Default: 41 */
  headerHeight?: number;
  /** Height of each row in pixels. Default: 49 */
  rowHeight?: number;
  /** Minimum page size. Default: 5 */
  minSize?: number;
  /** Maximum page size. Default: 50 */
  maxSize?: number;
  /** Callback when page size changes */
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
    
    // Clamp between min and max
    size = Math.max(minSize, Math.min(maxSize, size));
    
    if (size !== lastSizeRef.current) {
      lastSizeRef.current = size;
      setCalculatedSize(size);
      onSizeChange?.(size);
    }
  }, [headerHeight, rowHeight, minSize, maxSize, onSizeChange]);

  useEffect(() => {
    // Initial calculation with a small delay to ensure DOM is ready
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
