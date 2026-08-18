// ============================================================
// WAYTERO ADMIN — TOUR BOOKING MANAGE MODALS
// Collect advance / assign fleet / edit trip / add charge / settle.
// Doc Ref: BRD Part 5 §6, BRD Part 3 §45
// ============================================================
import { useEffect, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  MenuItem, Stack, Typography, Alert, CircularProgress, Divider, Box, Chip,
} from "@mui/material";
import { Payments, DirectionsCar, EditCalendar, AddCircle, AccountBalance } from "@mui/icons-material";
import type { TourManagePayload } from "../../../services/tour.service";

const fieldSx = { mt: 1 };

// ── Collect advance / payment ──────────────────────────────────
// The same modal collects an advance during the trip and the final
// balance after completion — pass `isFullPayment` to relabel it.
export function TourAdvanceModal({
  open, onClose, onSubmit, submitting, totalAmount, advanceTotal, isFullPayment = false,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (p: { amount: number; payment_mode: string; received_by: string; reference_number?: string; notes?: string }) => void;
  submitting: boolean;
  totalAmount: number;
  advanceTotal: number;
  isFullPayment?: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("CASH");
  const [receivedBy, setReceivedBy] = useState("ADMIN");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) { setAmount(""); setMode("CASH"); setReceivedBy("ADMIN"); setReference(""); setNotes(""); }
  }, [open]);

  const balanceDue = Math.max(totalAmount - advanceTotal, 0);
  const amt = Number(amount) || 0;

  return (
    <Dialog open={open} onClose={() => !submitting && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1 }}>
        <Payments color="primary" /> {isFullPayment ? "Collect payment" : "Collect advance"}
      </DialogTitle>
      <DialogContent>
        <Alert severity={isFullPayment ? "warning" : "info"} sx={{ borderRadius: 2, mb: 2 }}>
          {isFullPayment ? "Final payment" : "Balance due"} on this booking: <b>₹{balanceDue.toLocaleString("en-IN")}</b>
        </Alert>
        <TextField label="Amount (₹)" type="number" fullWidth value={amount}
          onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ""))} sx={fieldSx} autoFocus
          helperText={amt > balanceDue ? "Exceeds the balance due" : undefined}
          error={amt > balanceDue} />
        <TextField select label="Payment mode" fullWidth value={mode} onChange={e => setMode(e.target.value)} sx={fieldSx}>
          {["CASH", "ONLINE", "UPI", "WALLET"].map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
        </TextField>
        <TextField select label="Received by" fullWidth value={receivedBy} onChange={e => setReceivedBy(e.target.value)} sx={fieldSx}
          helperText="ADMIN = platform holds the money. PARTNER/DRIVER = partner side holds it (affects settlement).">
          {["ADMIN", "PARTNER", "DRIVER"].map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </TextField>
        {receivedBy !== "ADMIN" && mode === "ONLINE" && (
          <Alert severity="warning" sx={{ mt: 1.5, borderRadius: 2 }}>Online payments can only be received by ADMIN.</Alert>
        )}
        <TextField label="Reference (UPI / gateway / cash note)" fullWidth value={reference}
          onChange={e => setReference(e.target.value)} sx={fieldSx} placeholder="Optional" />
        <TextField label="Notes" fullWidth multiline minRows={2} value={notes}
          onChange={e => setNotes(e.target.value)} sx={fieldSx} placeholder="Optional" />
      </DialogContent>
      <DialogActions sx={{ p: 2.5, gap: 1 }}>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="contained" startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <Payments />}
          disabled={submitting || amt <= 0 || amt > balanceDue}
          onClick={() => onSubmit({ amount: amt, payment_mode: mode, received_by: receivedBy, reference_number: reference.trim() || undefined, notes: notes.trim() || undefined })}>
          {submitting ? "Recording…" : isFullPayment ? "Record payment" : "Record advance"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Assign vehicle + driver ────────────────────────────────────
export function TourFleetModal({
  open, onClose, onSubmit, submitting, fleet, current,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (p: { vehicle_id?: number | null; driver_id?: number | null }) => void;
  submitting: boolean;
  fleet?: TourManagePayload["fleet"];
  current?: TourManagePayload;
}) {
  const [vehicleId, setVehicleId] = useState<string>("");
  const [driverId, setDriverId] = useState<string>("");

  useEffect(() => {
    if (open) {
      setVehicleId(current?.vehicle ? String(current.vehicle.id) : "");
      setDriverId(current?.driver ? String(current.driver.id) : "");
    }
  }, [open, current]);

  const vehicles = fleet?.vehicles ?? [];
  const drivers = fleet?.drivers ?? [];

  return (
    <Dialog open={open} onClose={() => !submitting && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1 }}>
        <DirectionsCar color="primary" /> Assign vehicle & driver
      </DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ borderRadius: 2, mb: 2 }}>
          Pick from the package partner's fleet. The driver must belong to the same partner.
        </Alert>
        <TextField select label="Vehicle" fullWidth value={vehicleId} onChange={e => setVehicleId(e.target.value)} sx={fieldSx}
          helperText={vehicles.length === 0 ? "No active vehicles for this partner" : undefined}>
          <MenuItem value=""><em>No vehicle</em></MenuItem>
          {vehicles.map(v => (
            <MenuItem key={v.id} value={String(v.id)}>
              {v.registration_number} — {[v.vehicle_brand, v.vehicle_model].filter(Boolean).join(" ") || "Vehicle"} ({v.seating_capacity ?? "?"} seats)
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Driver" fullWidth value={driverId} onChange={e => setDriverId(e.target.value)} sx={fieldSx}
          helperText={drivers.length === 0 ? "No active drivers for this partner" : undefined}>
          <MenuItem value=""><em>No driver</em></MenuItem>
          {drivers.map(d => (
            <MenuItem key={d.id} value={String(d.id)}>{d.full_name}{d.mobile ? ` · ${d.mobile}` : ""}</MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions sx={{ p: 2.5, gap: 1 }}>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="contained" startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <DirectionsCar />}
          disabled={submitting}
          onClick={() => onSubmit({
            vehicle_id: vehicleId ? Number(vehicleId) : null,
            driver_id: driverId ? Number(driverId) : null,
          })}>
          {submitting ? "Assigning…" : "Assign fleet"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Edit trip (dates / travellers / pickup / details) ─────────
export function TourEditTripModal({
  open, onClose, onSubmit, submitting, booking,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (p: Record<string, unknown>) => void;
  submitting: boolean;
  booking?: TourManagePayload | null;
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [persons, setPersons] = useState(1);
  const [pickup, setPickup] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [hotel, setHotel] = useState("");
  const [other, setOther] = useState("");

  useEffect(() => {
    if (open && booking) {
      setStartDate(booking.travel_start_date?.slice(0, 10) ?? "");
      setEndDate(booking.travel_end_date?.slice(0, 10) ?? "");
      setPersons(booking.persons_count);
      setPickup(booking.pickup_location ?? "");
      setPickupTime(booking.pickup_datetime ? booking.pickup_datetime.slice(0, 16) : "");
      setHotel(booking.hotel_details ?? "");
      setOther(booking.other_details ?? "");
    }
  }, [open, booking]);

  return (
    <Dialog open={open} onClose={() => !submitting && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1 }}>
        <EditCalendar color="primary" /> Edit trip
      </DialogTitle>
      <DialogContent>
        <Stack direction="row" spacing={2}>
          <TextField label="Travel start" type="date" fullWidth value={startDate} onChange={e => setStartDate(e.target.value)} sx={fieldSx} InputLabelProps={{ shrink: true }} />
          <TextField label="Travel end" type="date" fullWidth value={endDate} onChange={e => setEndDate(e.target.value)} sx={fieldSx} InputLabelProps={{ shrink: true }} />
        </Stack>
        <TextField label="Travellers" type="number" fullWidth value={persons}
          onChange={e => setPersons(Math.max(1, Number(e.target.value) || 1))} sx={fieldSx}
          helperText="Changing travellers reprices the package from its pricing slabs." />
        <TextField label="Pickup location" fullWidth value={pickup} onChange={e => setPickup(e.target.value)} sx={fieldSx} />
        <TextField label="Pickup date & time" type="datetime-local" fullWidth value={pickupTime} onChange={e => setPickupTime(e.target.value)} sx={fieldSx} InputLabelProps={{ shrink: true }} />
        <TextField label="Hotel details (accommodation plan)" fullWidth multiline minRows={2} value={hotel} onChange={e => setHotel(e.target.value)} sx={fieldSx} />
        <TextField label="Other details (notes for driver / vendor)" fullWidth multiline minRows={2} value={other} onChange={e => setOther(e.target.value)} sx={fieldSx} />
      </DialogContent>
      <DialogActions sx={{ p: 2.5, gap: 1 }}>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="contained" startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <EditCalendar />}
          disabled={submitting}
          onClick={() => onSubmit({
            travel_start_date: startDate || undefined,
            travel_end_date: endDate || undefined,
            persons_count: persons !== (booking?.persons_count ?? -1) ? persons : undefined,
            pickup_location: pickup,
            pickup_datetime: pickupTime ? new Date(pickupTime).toISOString() : undefined,
            hotel_details: hotel,
            other_details: other,
          })}>
          {submitting ? "Saving…" : "Save changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Additional charge ──────────────────────────────────────────
export function TourChargeModal({
  open, onClose, onSubmit, submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (p: { label: string; amount: number; reason?: string }) => void;
  submitting: boolean;
}) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) { setLabel(""); setAmount(""); setReason(""); }
  }, [open]);

  const amt = Number(amount) || 0;
  return (
    <Dialog open={open} onClose={() => !submitting && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1 }}>
        <AddCircle color="primary" /> Add additional charge
      </DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ borderRadius: 2, mb: 2 }}>
          For trip modifications — extra days, extra stops. Splits with the partner at settlement by the booking's commission rate.
        </Alert>
        <TextField label="Label" fullWidth value={label} onChange={e => setLabel(e.target.value)} sx={fieldSx}
          placeholder="e.g. Extra day (Day 5)" autoFocus />
        <TextField label="Amount (₹)" type="number" fullWidth value={amount}
          onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ""))} sx={fieldSx} />
        <TextField label="Reason" fullWidth multiline minRows={2} value={reason} onChange={e => setReason(e.target.value)} sx={fieldSx} placeholder="Optional" />
      </DialogContent>
      <DialogActions sx={{ p: 2.5, gap: 1 }}>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="contained" startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <AddCircle />}
          disabled={submitting || !label.trim() || amt <= 0}
          onClick={() => onSubmit({ label: label.trim(), amount: amt, reason: reason.trim() || undefined })}>
          {submitting ? "Adding…" : "Add charge"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Settle confirm ─────────────────────────────────────────────
export function TourSettleDialog({
  open, onClose, onSubmit, submitting, booking,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
  booking?: TourManagePayload | null;
}) {
  if (!booking) return null;
  const partnerHeld = booking.advances
    .filter(a => a.status === "ACTIVE" && ["PARTNER", "DRIVER"].includes(a.received_by))
    .reduce((s, a) => s + a.amount, 0);
  const net = booking.partner_payout - partnerHeld;
  const direction = net > 0 ? "CREDIT" : net < 0 ? "DEBIT" : "NONE";

  return (
    <Dialog open={open} onClose={() => !submitting && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1 }}>
        <AccountBalance color="primary" /> Settle with partner
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ my: 1 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="body2" color="text.secondary">Partner payout</Typography>
            <Typography variant="body2" fontWeight={700}>₹{booking.partner_payout.toLocaleString("en-IN")}</Typography>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="body2" color="text.secondary">Partner side holds (advances)</Typography>
            <Typography variant="body2" fontWeight={700}>₹{partnerHeld.toLocaleString("en-IN")}</Typography>
          </Box>
          <Divider />
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="body2" fontWeight={700}>Net settlement</Typography>
            <Typography variant="body2" fontWeight={800}>₹{Math.abs(net).toLocaleString("en-IN")}</Typography>
          </Box>
          <Chip
            label={direction === "CREDIT" ? "Credit partner wallet" : direction === "DEBIT" ? "Debit partner wallet (commission)" : "No wallet movement"}
            color={direction === "CREDIT" ? "success" : direction === "DEBIT" ? "error" : "default"}
            sx={{ alignSelf: "flex-start", fontWeight: 700 }}
          />
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            This moves money between the partner wallet and the platform and marks the booking SETTLED. This cannot be undone.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2.5, gap: 1 }}>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="contained" color="primary" startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <AccountBalance />}
          disabled={submitting} onClick={onSubmit}>
          {submitting ? "Settling…" : "Confirm settlement"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
