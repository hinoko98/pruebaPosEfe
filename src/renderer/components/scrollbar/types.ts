import type { Theme, SxProps } from '@mui/material/styles';

// ----------------------------------------------------------------------

export type ScrollbarProps = Omit<React.ComponentProps<'div'>, 'ref'> & {
  sx?: SxProps<Theme>;
  fillContent?: boolean;
  slotProps?: {
    wrapperSx?: SxProps<Theme>;
    contentSx?: SxProps<Theme>;
    contentWrapperSx?: SxProps<Theme>;
  };
};
