import { useLayoutEffect, useRef, useState, type ReactNode, type TdHTMLAttributes } from 'react';

type MesDataCellProps = TdHTMLAttributes<HTMLTableCellElement> & {
  children: ReactNode;
  tooltip?: string | null;
};

export function MesDataCell({ children, className, tooltip, ...cellProps }: MesDataCellProps) {
  const contentRef = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);
  const tooltipText = tooltip?.trim() ?? '';

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content || !tooltipText) {
      setTruncated(false);
      return undefined;
    }
    const update = () => setTruncated(content.scrollWidth > content.clientWidth + 1);
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(content);
    return () => observer.disconnect();
  }, [children, tooltipText]);

  return <td {...cellProps} className={`mes-data-cell${truncated ? ' is-truncated' : ''}${className ? ` ${className}` : ''}`}>
    <span ref={contentRef} className="mes-data-cell__content">{children}</span>
    {truncated && <span className="mes-data-cell__tooltip" role="tooltip">{tooltipText}</span>}
  </td>;
}
