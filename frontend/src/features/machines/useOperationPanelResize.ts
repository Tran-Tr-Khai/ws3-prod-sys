import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';

type OperationDragState = {
  startX: number;
  startWidth: number;
  moved: boolean;
  width: number;
  collapsed: boolean;
  frame: number | null;
};

type UseOperationPanelResizeOptions = {
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  cssVariableName?: string;
};

type UseOperationPanelResizeResult = {
  operationCollapsed: boolean;
  operationWidth: number;
  operationLayoutRef: { current: HTMLDivElement | null };
  workspaceStyle: CSSProperties;
  handleDividerPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  handleDividerPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  handleDividerPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  handleDividerPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
  handleDividerKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
};

/**
 * Manage the draggable and keyboard-accessible operation panel divider.
 *
 * The hook updates the layout variable through requestAnimationFrame while a
 * pointer is moving, then commits the final width to React state on release.
 */
export function useOperationPanelResize(
  options: UseOperationPanelResizeOptions = {},
): UseOperationPanelResizeResult {
  const initialWidth = options.initialWidth ?? 272;
  const minWidth = options.minWidth ?? 220;
  const maxWidth = options.maxWidth ?? 420;
  const cssVariableName = options.cssVariableName ?? '--tentering-operation-width';
  const collapsedWidth = 10;
  const [operationCollapsed, setOperationCollapsed] = useState(false);
  const [operationWidth, setOperationWidth] = useState(initialWidth);
  const operationLayoutRef = useRef<HTMLDivElement>(null);
  const operationDragRef = useRef<OperationDragState | null>(null);
  const workspaceStyle = {
    [cssVariableName]: `${operationCollapsed ? collapsedWidth : operationWidth}px`,
  } as CSSProperties;

  /** Begin a divider drag when the primary pointer button is pressed. */
  const handleDividerPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    operationDragRef.current = {
      startX: event.clientX,
      startWidth: operationCollapsed ? 40 : operationWidth,
      moved: false,
      width: operationCollapsed ? collapsedWidth : operationWidth,
      collapsed: operationCollapsed,
      frame: null,
    };
  };

  /** Apply the current drag position without forcing a React render per event. */
  const handleDividerPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = operationDragRef.current;
    if (!drag) return;
    const delta = event.clientX - drag.startX;
    if (Math.abs(delta) > 4) drag.moved = true;
    if (!drag.moved) return;
    const nextWidth = drag.startWidth + delta;
    const nextCollapsed = nextWidth <= collapsedWidth;
    const width = nextCollapsed
      ? collapsedWidth
      : Math.min(maxWidth, Math.max(collapsedWidth, nextWidth));
    drag.width = width;
    if (drag.collapsed !== nextCollapsed) {
      drag.collapsed = nextCollapsed;
      setOperationCollapsed(nextCollapsed);
      setOperationWidth(nextCollapsed ? collapsedWidth : width);
    }
    if (drag.frame === null) {
      drag.frame = window.requestAnimationFrame(() => {
        drag.frame = null;
        operationLayoutRef.current?.style.setProperty(cssVariableName, `${drag.width}px`);
      });
    }
  };

  /** Commit the final divider position or toggle collapse for a click. */
  const handleDividerPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = operationDragRef.current;
    operationDragRef.current = null;
    if (drag?.frame !== null && drag?.frame !== undefined) window.cancelAnimationFrame(drag.frame);
    if (drag && !drag.moved) {
      const collapsed = !operationCollapsed;
      setOperationCollapsed(collapsed);
      setOperationWidth(collapsed ? collapsedWidth : operationWidth);
      operationLayoutRef.current?.style.setProperty(
        cssVariableName,
        `${collapsed ? collapsedWidth : operationWidth}px`,
      );
    } else if (drag) {
      setOperationCollapsed(drag.collapsed);
      setOperationWidth(drag.collapsed ? collapsedWidth : drag.width);
      operationLayoutRef.current?.style.setProperty(
        cssVariableName,
        `${drag.collapsed ? collapsedWidth : drag.width}px`,
      );
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  /** Stop a cancelled drag while preserving the last rendered divider width. */
  const handleDividerPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    const drag = operationDragRef.current;
    operationDragRef.current = null;
    if (drag?.frame !== null && drag?.frame !== undefined) window.cancelAnimationFrame(drag.frame);
    if (drag?.moved) {
      setOperationCollapsed(drag.collapsed);
      setOperationWidth(drag.collapsed ? collapsedWidth : drag.width);
      operationLayoutRef.current?.style.setProperty(
        cssVariableName,
        `${drag.collapsed ? collapsedWidth : drag.width}px`,
      );
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  /** Resize or toggle the operation panel from keyboard controls. */
  const handleDividerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOperationCollapsed((current) => !current);
      return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 16 : -16;
    setOperationCollapsed(false);
    setOperationWidth((current) => Math.min(maxWidth, Math.max(minWidth, current + delta)));
  };

  return {
    operationCollapsed,
    operationWidth,
    operationLayoutRef,
    workspaceStyle,
    handleDividerPointerDown,
    handleDividerPointerMove,
    handleDividerPointerUp,
    handleDividerPointerCancel,
    handleDividerKeyDown,
  };
}
