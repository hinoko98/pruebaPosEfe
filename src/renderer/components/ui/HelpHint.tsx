import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

export default function HelpHint({
  title,
  placement = "right",
}: {
  title: string;
  placement?: "bottom" | "left" | "right" | "top";
}) {
  return (
    <Tooltip title={title} arrow placement={placement}>
      <IconButton size="small" sx={{ p: 0.25, color: "text.secondary" }}>
        <InfoOutlinedIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Tooltip>
  );
}
