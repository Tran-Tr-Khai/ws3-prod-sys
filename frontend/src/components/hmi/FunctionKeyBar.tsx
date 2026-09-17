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
    <nav className="grid grid-cols-2 gap-1.5 border-t-4 border-industrialDark bg-[#aebbc2] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] sm:grid-cols-4 lg:grid-cols-6">
      {keys.map((item) => (
        <HMIButton key={item.key} size="compact" disabled={item.disabled} onClick={item.onClick} className={item.active ? "border-industrialDark bg-industrial text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.2)]" : "border-line bg-[#e7ecee] text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] hover:bg-white active:shadow-[inset_0_2px_2px_rgba(57,78,93,0.25)]"}>
          <span className={`mr-2 border-r pr-2 font-mono ${item.active ? "border-white/40 text-white" : "border-line text-industrial"}`}>{item.key}</span>
          {item.label}
        </HMIButton>
      ))}
    </nav>
  );
}
