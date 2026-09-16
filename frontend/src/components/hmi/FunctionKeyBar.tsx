import { HMIButton } from './HMIButton';

export type FunctionKey = {
  key: string;
  label: string;
  disabled?: boolean;
};

type FunctionKeyBarProps = {
  keys: FunctionKey[];
};

export function FunctionKeyBar({ keys }: FunctionKeyBarProps) {
  return (
    <nav className="grid grid-cols-2 gap-2 border-t border-line bg-surfaceMuted p-2 sm:grid-cols-4 lg:grid-cols-6">
      {keys.map((item) => (
        <HMIButton key={item.key} size="compact" disabled={item.disabled}>
          <span className="mr-2 font-mono text-industrial">{item.key}</span>
          {item.label}
        </HMIButton>
      ))}
    </nav>
  );
}
