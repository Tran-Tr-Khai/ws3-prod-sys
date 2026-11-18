/** Machine state used by shared MES status controls. */
export type MesStatus =
  | 'running'
  | 'normal'
  | 'warning'
  | 'alarm'
  | 'stopped'
  | 'maintenance'
  | 'offline'
  | 'info';

export type MesButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export type MesButtonSize = 'compact' | 'normal' | 'large';
