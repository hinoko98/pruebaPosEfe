import type { SxProps, Theme } from "@mui/material/styles";
import type { SvgIconProps } from "@mui/material/SvgIcon";

import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import FilterListIcon from "@mui/icons-material/FilterList";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import SearchIcon from "@mui/icons-material/Search";

type IconifyName =
  | "mingcute:add-line"
  | "eva:search-fill"
  | "solar:trash-bin-trash-bold"
  | "ic:round-filter-list"
  | "solar:check-circle-bold"
  | "eva:more-vertical-fill"
  | "solar:pen-bold";

type IconifyProps = Omit<SvgIconProps, "color"> & {
  icon: IconifyName | string;
  width?: number;
  height?: number;
  sx?: SxProps<Theme>;
};

const iconMap = {
  "mingcute:add-line": AddIcon,
  "eva:search-fill": SearchIcon,
  "solar:trash-bin-trash-bold": DeleteIcon,
  "ic:round-filter-list": FilterListIcon,
  "solar:check-circle-bold": CheckCircleIcon,
  "eva:more-vertical-fill": MoreVertIcon,
  "solar:pen-bold": EditIcon,
} as const;

export function Iconify({ icon, width = 20, height, sx, ...other }: IconifyProps) {
  const IconComponent = iconMap[icon as keyof typeof iconMap] ?? HelpOutlineIcon;

  return (
    <IconComponent
      sx={[
        {
          width,
          height: height ?? width,
          flexShrink: 0,
          display: "inline-flex",
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...other}
    />
  );
}
