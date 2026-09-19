import { HMIButton } from './HMIButton';

export type FunctionKey = {
  key: string;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
  active?: boolean;
};

type FunctionKeyBarProps = {
  keys: FunctionKey[];
};

export function FunctionKeyBar({ keys }: FunctionKeyBarProps) {
  return (
    <nav className="grid grid-cols-2 gap-0 border-t-2 border-industrialDark bg-hmiRail px-1 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] sm:grid-cols-4 lg:grid-cols-6">
      {keys.map((item) => (
        <HMIButton
          key={item.key}
          size="compact"
          disabled={item.disabled}
          onClick={item.onClick}
          className={item.active
            ? "min-h-[52px] flex-col gap-0.5 border-0 border-r border-white/30 bg-industrial text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.2)] last:border-r-0"
            : "min-h-[52px] flex-col gap-0.5 border-0 border-r border-line bg-transparent text-slate-700 shadow-none hover:bg-hmiHover active:shadow-[inset_0_2px_2px_rgba(57,78,93,0.25)] last:border-r-0"}
        >
          <span className={item.active ? "font-mono text-[11px] font-bold leading-none text-white" : "font-mono text-[11px] font-bold leading-none text-industrial"}>{item.key}</span>
          <span className="text-xs leading-none">{item.label}</span>
        </HMIButton>
      ))}
    </nav>
  );
}