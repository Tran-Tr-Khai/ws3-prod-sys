import type { ButtonHTMLAttributes } from 'react';
import type { HMIButtonSize, HMIButtonVariant } from './types';

type HMIButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: HMIButtonVariant;
  size?: HMIButtonSize;
};

const variantClasses: Record<HMIButtonVariant, string> = {
  primary: 'border-industrial bg-industrial text-white hover:bg-industrialDark',
  secondary: 'border-line bg-white text-slate-700 hover:bg-surfaceMuted',
  danger: 'border-alarm bg-alarm text-white hover:bg-red-700',
  ghost: 'border-transparent bg-transparent text-industrial hover:bg-blue-50',
};

const sizeClasses: Record<HMIButtonSize, string> = {
  compact: 'min-h-8 px-3 text-xs',
  normal: 'min-h-10 px-4 text-sm',
  large: 'min-h-12 px-5 text-base',
};

export function HMIButton({
  variant = 'secondary',
  size = 'normal',
  className = '',
  type = 'button',
  ...props
}: HMIButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    />
  );
}
