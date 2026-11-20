import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
  type ThHTMLAttributes,
} from 'react';

type ResizeState = { index: number; startX: number; startWidth: number };

type MesResizableTableContextValue = {
  widths: number[];
  startResize: (index: number, event: React.PointerEvent<HTMLSpanElement>) => void;
};

const MesResizableTableContext = createContext<MesResizableTableContextValue | null>(null);

type MesResizableTableProps = HTMLAttributes<HTMLTableElement> & {
  initialWidths: number[];
  storageKey: string;
  children: ReactNode;
};

const MIN_COLUMN_WIDTH = 56;
const MAX_COLUMN_WIDTH = 460;

/**
 * Render a table whose column widths can be adjusted and retained per screen.
 *
 * Args:
 *   initialWidths: Default column widths in pixels.
 *   storageKey: Browser-storage key scoped to the table screen.
 *
 * Returns:
 *   A table context used by `MesResizableHeaderCell` resize handles.
 */
export function MesResizableTable({
  initialWidths,
  storageKey,
  children,
  className,
  ...tableProps
}: MesResizableTableProps) {
  const [widths, setWidths] = useState(initialWidths);
  const resizeRef = useRef<ResizeState | null>(null);

  useEffect(() => {
    // Column definitions can arrive after the first render (for example when
    // a data-warehouse response provides its headers). Reset the table model
    // whenever that definition changes so every header gets a resize handle.
    setWidths(initialWidths);
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return;
      const parsed: unknown = JSON.parse(stored);
      if (
        Array.isArray(parsed) &&
        parsed.length === initialWidths.length &&
        parsed.every((value) => typeof value === 'number' && Number.isFinite(value))
      ) {
        setWidths(
          parsed.map((value) => Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, value))),
        );
      }
    } catch {
      // A bad saved preference should never prevent the table from rendering.
    }
  }, [initialWidths, storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(widths));
    } catch {
      // Storage can be disabled in private or restricted browser contexts.
    }
  }, [storageKey, widths]);

  const startResize = useCallback(
    (index: number, event: React.PointerEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();
      resizeRef.current = { index, startX: event.clientX, startWidth: widths[index] };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      document.body.classList.add('mes-is-resizing-column');
    },
    [widths],
  );

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const active = resizeRef.current;
      if (!active) return;
      const nextWidth = Math.min(
        MAX_COLUMN_WIDTH,
        Math.max(MIN_COLUMN_WIDTH, active.startWidth + event.clientX - active.startX),
      );
      setWidths((current) =>
        current.map((width, index) => (index === active.index ? nextWidth : width)),
      );
    };
    const stopResize = () => {
      if (!resizeRef.current) return;
      resizeRef.current = null;
      document.body.classList.remove('mes-is-resizing-column');
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResize);
    window.addEventListener('pointercancel', stopResize);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResize);
      window.removeEventListener('pointercancel', stopResize);
      document.body.classList.remove('mes-is-resizing-column');
    };
  }, []);

  return (
    <MesResizableTableContext.Provider value={{ widths, startResize }}>
      <table {...tableProps} className={`mes-resizable-table${className ? ` ${className}` : ''}`}>
        <colgroup>
          {widths.map((width, index) => (
            <col key={index} style={{ width: `${width}px` }} />
          ))}
        </colgroup>
        {children}
      </table>
    </MesResizableTableContext.Provider>
  );
}

type MesResizableHeaderCellProps = ThHTMLAttributes<HTMLTableCellElement> & {
  index: number;
  children: ReactNode;
};

/** Render one resizable table-header cell within `MesResizableTable`. */
export function MesResizableHeaderCell({
  index,
  children,
  className,
  style,
  ...headerProps
}: MesResizableHeaderCellProps) {
  const context = useContext(MesResizableTableContext);
  if (!context) throw new Error('MesResizableHeaderCell must be used inside MesResizableTable');
  const width = context.widths[index];
  return (
    <th
      {...headerProps}
      className={`mes-resizable-header${className ? ` ${className}` : ''}`}
      style={{ ...style, width }}
    >
      <span className="mes-resizable-header__label">{children}</span>
      <span
        className="mes-resizable-header__handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize column"
        onPointerDown={(event) => context.startResize(index, event)}
      />
    </th>
  );
}
