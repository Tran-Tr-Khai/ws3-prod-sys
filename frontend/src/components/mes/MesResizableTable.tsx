import { createContext, useCallback, useContext, useEffect, useRef, useState, type HTMLAttributes, type ReactNode, type ThHTMLAttributes } from 'react';

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

export function MesResizableTable({ initialWidths, storageKey, children, className, ...tableProps }: MesResizableTableProps) {
  const defaultWidths = useRef(initialWidths).current;
  const [widths, setWidths] = useState(defaultWidths);
  const resizeRef = useRef<ResizeState | null>(null);

  useEffect(() => {
    setWidths(defaultWidths);
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return;
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length === defaultWidths.length && parsed.every((value) => typeof value === 'number' && Number.isFinite(value))) {
        setWidths(parsed.map((value) => Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, value))));
      }
    } catch {
      // A bad saved preference should never prevent the table from rendering.
    }
  }, [defaultWidths, storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(widths));
    } catch {
      // Storage can be disabled in private or restricted browser contexts.
    }
  }, [storageKey, widths]);

  const startResize = useCallback((index: number, event: React.PointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = { index, startX: event.clientX, startWidth: widths[index] };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    document.body.classList.add('mes-is-resizing-column');
  }, [widths]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const active = resizeRef.current;
      if (!active) return;
      const nextWidth = Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, active.startWidth + event.clientX - active.startX));
      setWidths((current) => current.map((width, index) => index === active.index ? nextWidth : width));
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

  return <MesResizableTableContext.Provider value={{ widths, startResize }}>
    <table {...tableProps} className={`mes-resizable-table${className ? ` ${className}` : ''}`}>
      <colgroup>{widths.map((width, index) => <col key={index} style={{ width: `${width}px` }} />)}</colgroup>
      {children}
    </table>
  </MesResizableTableContext.Provider>;
}

type MesResizableHeaderCellProps = ThHTMLAttributes<HTMLTableCellElement> & {
  index: number;
  children: ReactNode;
};

export function MesResizableHeaderCell({ index, children, className, style, ...headerProps }: MesResizableHeaderCellProps) {
  const context = useContext(MesResizableTableContext);
  if (!context) throw new Error('MesResizableHeaderCell must be used inside MesResizableTable');
  const width = context.widths[index];
  return <th {...headerProps} className={`mes-resizable-header${className ? ` ${className}` : ''}`} style={{ ...style, width }}>
    <span className="mes-resizable-header__label">{children}</span>
    <span className="mes-resizable-header__handle" role="separator" aria-orientation="vertical" aria-label="Resize column" onPointerDown={(event) => context.startResize(index, event)} />
  </th>;
}
