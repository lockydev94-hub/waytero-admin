// ============================================================
// WAYTERO ADMIN — HOTEL STATUS CHIP
// Doc Ref: 03_FRONTEND_DESIGN.md §7
//
// Status is never conveyed by colour alone — the chip always carries text.
// ============================================================
import { Chip } from "@mui/material";
import type { ChipProps } from "@mui/material";
import {
  Block,
  Cancel,
  CheckCircle,
  Description,
  EditNote,
  FactCheck,
  HourglassEmpty,
  PauseCircle,
  TaskAlt,
} from "@mui/icons-material";
import { HOTEL_STATUS_META } from "../../../services/hotel.service";

const ICONS: Record<string, React.ReactNode> = {
  DRAFT: <EditNote fontSize="small" />,
  PENDING: <HourglassEmpty fontSize="small" />,
  UNDER_REVIEW: <FactCheck fontSize="small" />,
  DOCUMENT_PENDING: <Description fontSize="small" />,
  APPROVED: <TaskAlt fontSize="small" />,
  ACTIVE: <CheckCircle fontSize="small" />,
  INACTIVE: <PauseCircle fontSize="small" />,
  SUSPENDED: <PauseCircle fontSize="small" />,
  BLOCKED: <Block fontSize="small" />,
  REJECTED: <Cancel fontSize="small" />,
};

interface Props {
  status: string;
  size?: ChipProps["size"];
  withIcon?: boolean;
}

export default function HotelStatusChip({ status, size = "small", withIcon = true }: Props) {
  const meta = HOTEL_STATUS_META[status] ?? { label: status, color: "default" as const };
  return (
    <Chip
      label={meta.label}
      color={meta.color}
      size={size}
      variant="filled"
      icon={withIcon ? (ICONS[status] as React.ReactElement | undefined) : undefined}
      sx={{ fontWeight: 700, borderRadius: 1.5 }}
    />
  );
}
