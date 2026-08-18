// ============================================================
// CUSTOMER CARE — CUSTOMER LOOKUP / REGISTER MODAL
// Step 1: Enter mobile → check if customer exists
// Step 2a: Existing customer → show profile + actions
// Step 2b: New customer → register form
// ============================================================
import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Stack, Typography, TextField, Button, Divider,
  Avatar, Chip, CircularProgress, Alert, IconButton,
  Grid, alpha, useTheme, InputAdornment,
} from "@mui/material";
import {
  PhoneAndroid, PersonAdd, Close, Search, CheckCircle,
  PersonOff, DirectionsCar, HeadsetMic, ArrowForward,
  CalendarMonth, Bookmark, Hotel, TravelExplore, ArrowBack, ChevronRight,
} from "@mui/icons-material";
import { useForm } from "react-hook-form";
import { customerCareService, CustomerLookup } from "../../../services/customerCare.service";
import { format } from "date-fns";

type Step = "lookup" | "register" | "found" | "service";

// Booking service the agent picks before we route to that service's form.
export type BookingService = "CAB" | "HOTEL" | "TOUR";

interface Props {
  open: boolean;
  onClose: () => void;
  onCustomerSelected: (
    customer: CustomerLookup,
    action: "booking" | "issue",
    service?: BookingService,
  ) => void;
}

interface RegisterForm {
  first_name: string;
  last_name: string;
  mobile_number: string;
  email: string;
  city_id: string;
}

// Bookable services shown on the service-selection step. Only enabled
// services route to a form; the rest are placeholders for upcoming work.
const SERVICES: {
  key: BookingService;
  label: string;
  desc: string;
  color: string;
  icon: JSX.Element;
  enabled: boolean;
}[] = [
  { key: "CAB", label: "Cab Booking", desc: "Point-to-point, rentals & outstation trips", color: "#2563EB", icon: <DirectionsCar />, enabled: true },
  { key: "HOTEL", label: "Hotel Booking", desc: "Rooms priced live with taxes & inventory", color: "#7C3AED", icon: <Hotel />, enabled: true },
  { key: "TOUR", label: "Tour Package", desc: "Curated itineraries with partner pricing", color: "#059669", icon: <TravelExplore />, enabled: true },
];

export default function CustomerLookupModal({ open, onClose, onCustomerSelected }: Props) {
  const theme = useTheme();
  const [mobile, setMobile] = useState("");
  const [step, setStep] = useState<Step>("lookup");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customer, setCustomer] = useState<CustomerLookup | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<RegisterForm>();

  function handleClose() {
    setMobile("");
    setStep("lookup");
    setError("");
    setCustomer(null);
    reset();
    onClose();
  }

  async function handleLookup() {
    if (!mobile || mobile.length < 10) { setError("Enter a valid 10-digit mobile number"); return; }
    setLoading(true); setError("");
    try {
      const result = await customerCareService.lookup(mobile);
      setCustomer(result);
      setStep(result.found ? "found" : "register");
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Lookup failed");
    } finally { setLoading(false); }
  }

  async function handleRegister(data: RegisterForm) {
    setLoading(true); setError("");
    try {
      const result = await customerCareService.registerCustomer({
        first_name: data.first_name,
        last_name: data.last_name || undefined,
        mobile_number: mobile,
        email: data.email || undefined,
        city_id: data.city_id ? Number(data.city_id) : undefined,
      });
      setCustomer(result);
      setStep("found");
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Registration failed");
    } finally { setLoading(false); }
  }

  const infoRow = (label: string, value: string | undefined | null) => value ? (
    <Box>
      <Typography variant="caption" color="text.secondary" fontWeight={600}>{label}</Typography>
      <Typography fontSize={14} fontWeight={500}>{value}</Typography>
    </Box>
  ) : null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}>

      {/* Header */}
      <DialogTitle sx={{
        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
        color: "#fff", p: 3,
      }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1.5}>
            <Box sx={{ p: 1, borderRadius: 2, bgcolor: "rgba(255,255,255,0.15)" }}>
              <HeadsetMic sx={{ color: "#fff", fontSize: 22 }} />
            </Box>
            <Box>
              <Typography fontWeight={700} fontSize={18}>Customer Care Session</Typography>
              <Typography fontSize={12} sx={{ opacity: 0.8 }}>
                {step === "lookup" ? "Look up customer by mobile" :
                 step === "register" ? "Register new customer" :
                 step === "service" ? "Choose a service to book" : "Customer found"}
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={handleClose} sx={{ color: "rgba(255,255,255,0.7)" }}>
            <Close />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError("")}>{error}</Alert>}

        {/* STEP 1: Lookup */}
        {step === "lookup" && (
          <Box>
            <Typography fontSize={14} color="text.secondary" mb={2.5}>
              Enter the customer's mobile number to check if they're registered in the system.
            </Typography>
            <Stack direction="row" gap={1.5}>
              <TextField
                fullWidth
                label="Customer Mobile Number"
                value={mobile}
                onChange={e => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                onKeyDown={e => e.key === "Enter" && handleLookup()}
                placeholder="10-digit mobile number"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PhoneAndroid color="primary" sx={{ fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
              />
              <Button
                variant="contained" onClick={handleLookup}
                disabled={loading || mobile.length < 10}
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Search />}
                sx={{ borderRadius: 2.5, minWidth: 120, fontWeight: 700, textTransform: "none" }}
              >
                Search
              </Button>
            </Stack>
          </Box>
        )}

        {/* STEP 2a: Register */}
        {step === "register" && (
          <Box>
            <Box sx={{
              p: 2, borderRadius: 2.5, bgcolor: alpha("#F59E0B", 0.08),
              border: "1px solid", borderColor: alpha("#F59E0B", 0.2), mb: 2.5,
              display: "flex", alignItems: "center", gap: 1.5,
            }}>
              <PersonOff sx={{ color: "#F59E0B" }} />
              <Box>
                <Typography fontWeight={700} fontSize={14} color="#92400E">Customer not found</Typography>
                <Typography fontSize={12} color="text.secondary">Mobile: {mobile} is not registered. Fill in details to register.</Typography>
              </Box>
            </Box>

            <Grid container spacing={2} component="form" onSubmit={handleSubmit(handleRegister)}>
              <Grid item xs={6}>
                <TextField fullWidth label="First Name *" size="small"
                  {...register("first_name", { required: "Required" })}
                  error={!!errors.first_name} helperText={errors.first_name?.message}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth label="Last Name" size="small"
                  {...register("last_name")}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Mobile Number" size="small" value={mobile} disabled
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Email (Optional)" size="small"
                  {...register("email")}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }} />
              </Grid>
            </Grid>

            <Stack direction="row" gap={1.5} mt={2.5}>
              <Button variant="outlined" onClick={() => { setStep("lookup"); setError(""); }}
                sx={{ borderRadius: 2, textTransform: "none" }}>
                Back
              </Button>
              <Button variant="contained" onClick={handleSubmit(handleRegister)}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <PersonAdd />}
                sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700 }}>
                Register Customer
              </Button>
            </Stack>
          </Box>
        )}

        {/* STEP 2b: Found */}
        {step === "found" && customer && (
          <Box>
            {/* Profile card */}
            <Box sx={{
              p: 2.5, borderRadius: 3, background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.06)}, ${alpha(theme.palette.primary.main, 0.02)})`,
              border: "1px solid", borderColor: alpha(theme.palette.primary.main, 0.15), mb: 3,
            }}>
              <Stack direction="row" alignItems="center" gap={2} mb={2}>
                <Avatar sx={{ width: 52, height: 52, bgcolor: theme.palette.primary.main, fontWeight: 800, fontSize: 20 }}>
                  {(customer.full_name || "?")[0].toUpperCase()}
                </Avatar>
                <Box flex={1}>
                  <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                    <Typography fontWeight={800} fontSize={18}>{customer.full_name}</Typography>
                    {!customer.found ? null : (
                      <Chip size="small" icon={<CheckCircle sx={{ fontSize: "14px !important" }} />}
                        label={customer.is_active ? "Active" : "Inactive"}
                        color={customer.is_active ? "success" : "error"} sx={{ fontWeight: 700, fontSize: 11 }} />
                    )}
                  </Stack>
                  <Typography color="text.secondary" fontSize={13}>{customer.mobile_number}</Typography>
                  {customer.customer_code && (
                    <Typography variant="caption" fontFamily="monospace" color="primary.main" fontWeight={700}>
                      {customer.customer_code}
                    </Typography>
                  )}
                </Box>
              </Stack>

              <Divider sx={{ my: 1.5 }} />

              <Grid container spacing={2}>
                {infoRow("Email", customer.email) && (
                  <Grid item xs={6}>{infoRow("Email", customer.email)}</Grid>
                )}
                {customer.created_at && (
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>Member Since</Typography>
                    <Typography fontSize={14} fontWeight={500}>
                      {format(new Date(customer.created_at), "dd MMM yyyy")}
                    </Typography>
                  </Grid>
                )}
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Total Bookings</Typography>
                  <Stack direction="row" alignItems="center" gap={0.5}>
                    <DirectionsCar sx={{ fontSize: 16, color: "primary.main" }} />
                    <Typography fontSize={14} fontWeight={700} color="primary.main">{customer.total_bookings ?? 0}</Typography>
                  </Stack>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Previous Issues</Typography>
                  <Stack direction="row" alignItems="center" gap={0.5}>
                    <HeadsetMic sx={{ fontSize: 16, color: "warning.main" }} />
                    <Typography fontSize={14} fontWeight={700} color="warning.main">{customer.total_issues ?? 0}</Typography>
                  </Stack>
                </Grid>
              </Grid>
            </Box>

            {/* Action buttons */}
            <Typography fontWeight={700} fontSize={13} color="text.secondary" mb={1.5}>
              WHAT WOULD YOU LIKE TO DO?
            </Typography>
            <Stack direction="row" gap={2}>
              <Button
                variant="contained" fullWidth
                startIcon={<DirectionsCar />}
                endIcon={<ArrowForward />}
                onClick={() => setStep("service")}
                sx={{
                  borderRadius: 2.5, py: 1.5, textTransform: "none", fontWeight: 700,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                }}
              >
                Create Booking
              </Button>
              <Button
                variant="outlined" fullWidth
                startIcon={<HeadsetMic />}
                endIcon={<ArrowForward />}
                onClick={() => { onCustomerSelected(customer, "issue"); handleClose(); }}
                sx={{ borderRadius: 2.5, py: 1.5, textTransform: "none", fontWeight: 700 }}
              >
                Log Issue
              </Button>
            </Stack>
          </Box>
        )}

        {/* STEP 3: Choose booking service */}
        {step === "service" && customer && (
          <Box>
            <Stack direction="row" alignItems="center" gap={1} mb={2.5}>
              <Avatar sx={{ width: 40, height: 40, bgcolor: theme.palette.primary.main, fontWeight: 800, fontSize: 16 }}>
                {(customer.full_name || "?")[0].toUpperCase()}
              </Avatar>
              <Box flex={1} minWidth={0}>
                <Typography fontWeight={700} fontSize={15} noWrap>{customer.full_name}</Typography>
                <Typography color="text.secondary" fontSize={12}>{customer.mobile_number}</Typography>
              </Box>
            </Stack>

            <Typography fontWeight={700} fontSize={13} color="text.secondary" mb={1.5}>
              SELECT SERVICE TO BOOK
            </Typography>

            <Stack gap={1.5}>
              {SERVICES.map((svc) => {
                const enabled = svc.enabled;
                return (
                  <Box
                    key={svc.key}
                    onClick={enabled ? () => { onCustomerSelected(customer, "booking", svc.key); handleClose(); } : undefined}
                    sx={{
                      p: 2, borderRadius: 2.5, border: "1px solid",
                      borderColor: enabled ? alpha(svc.color, 0.3) : "divider",
                      bgcolor: enabled ? alpha(svc.color, 0.04) : alpha(theme.palette.action.disabled, 0.02),
                      cursor: enabled ? "pointer" : "not-allowed",
                      opacity: enabled ? 1 : 0.6,
                      transition: "all 0.15s",
                      "&:hover": enabled ? { borderColor: svc.color, boxShadow: 2, transform: "translateY(-1px)" } : {},
                    }}
                  >
                    <Stack direction="row" alignItems="center" gap={2}>
                      <Box sx={{
                        width: 46, height: 46, borderRadius: 2, flexShrink: 0,
                        bgcolor: alpha(svc.color, 0.12), color: svc.color,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {svc.icon}
                      </Box>
                      <Box flex={1} minWidth={0}>
                        <Stack direction="row" alignItems="center" gap={1}>
                          <Typography fontWeight={700} fontSize={14.5}>{svc.label}</Typography>
                          {!enabled && (
                            <Chip label="Coming soon" size="small"
                              sx={{ height: 18, fontSize: 10, fontWeight: 700 }} />
                          )}
                        </Stack>
                        <Typography fontSize={12} color="text.secondary">{svc.desc}</Typography>
                      </Box>
                      {enabled && <ChevronRight sx={{ color: svc.color }} />}
                    </Stack>
                  </Box>
                );
              })}
            </Stack>

            <Button
              variant="text" startIcon={<ArrowBack />}
              onClick={() => setStep("found")}
              sx={{ mt: 2.5, textTransform: "none", fontWeight: 600 }}
            >
              Back
            </Button>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
