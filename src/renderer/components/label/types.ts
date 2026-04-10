import type { Theme, SxProps } from '@mui/material/styles';

// ----------------------------------------------------------------------

export type LabelColor =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

export type LabelVariant = 'filled' | 'outlined' | 'soft' | 'inverted';

export interface LabelProps extends Omit<React.ComponentProps<'span'>, 'ref'> {
  sx?: SxProps<Theme>;
  disabled?: boolean;
  color?: LabelColor;
  variant?: LabelVariant;
  endIcon?: React.ReactNode;
  startIcon?: React.ReactNode;
}
