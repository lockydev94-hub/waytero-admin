// ============================================================
// WAYTERO ADMIN — ONBOARDING DOCS PAGE
// Download partner onboarding guides + hand-fillable registration
// forms as print-quality PDFs (invoice-style platform header).
//
// Use case: a field agent / admin downloads the PDFs, fills the
// forms by hand, then registers the partner / vehicle / driver in
// the portal following the form. Guides tell the partner exactly
// what to prepare before applying.
// ============================================================
import { useState } from "react";
import {
  Box, Typography, Card, CardContent, CardHeader, Grid, Button,
  CircularProgress, Alert, Divider, Chip, Tooltip,
} from "@mui/material";
import {
  Download, Description, Assignment, Person, DirectionsCar,
  PictureAsPdf, VerifiedUser, Build, Info, Groups,
} from "@mui/icons-material";
import { useSnackbar } from "notistack";
import {
  downloadOnboardingGuide,
  downloadOnboardingForm,
  OnboardingDocType,
} from "../../services/onboardingDocs.service";

interface DocCard {
  key: string;
  kind: "guide" | "form";
  docType: OnboardingDocType;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
}

const DOC_CARDS: DocCard[] = [
  {
    key: "guide-partner",
    kind: "guide",
    docType: "partner",
    title: "Partner Registration Guide",
    subtitle: "Requirements & documents to become a WayTero partner (cab / hotel / tour).",
    icon: <Groups />,
    accent: "#1565c0",
  },
  {
    key: "guide-driver",
    kind: "guide",
    docType: "driver",
    title: "Driver Onboarding Guide",
    subtitle: "Requirements & documents to add a driver to your fleet.",
    icon: <Person />,
    accent: "#7c3aed",
  },
  {
    key: "guide-vehicle",
    kind: "guide",
    docType: "vehicle",
    title: "Vehicle Onboarding Guide",
    subtitle: "Requirements, 5 documents & 7 photos to add a vehicle.",
    icon: <DirectionsCar />,
    accent: "#0284c7",
  },
  {
    key: "form-partner",
    kind: "form",
    docType: "partner",
    title: "Partner Registration Form",
    subtitle: "Hand-fillable form — used to register the partner in the portal.",
    icon: <Assignment />,
    accent: "#16a34a",
  },
  {
    key: "form-vehicle",
    kind: "form",
    docType: "vehicle",
    title: "Vehicle Registration Form",
    subtitle: "Hand-fillable form — takes the Partner ID as reference.",
    icon: <Build />,
    accent: "#d97706",
  },
  {
    key: "form-driver",
    kind: "form",
    docType: "driver",
    title: "Driver Registration Form",
    subtitle: "Hand-fillable form — takes the Partner ID as reference.",
    icon: <Description />,
    accent: "#dc2626",
  },
];

export default function OnboardingDocsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [downloading, setDownloading] = useState<string | null>(null);

  async function handleDownload(card: DocCard) {
    setDownloading(card.key);
    try {
      if (card.kind === "guide") {
        await downloadOnboardingGuide(card.docType);
      } else {
        await downloadOnboardingForm(card.docType);
      }
      enqueueSnackbar(`${card.title} downloaded`, { variant: "success" });
    } catch {
      enqueueSnackbar(`Failed to download ${card.title}`, { variant: "error" });
    } finally {
      setDownloading(null);
    }
  }

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Onboarding Documents</Typography>
          <Typography variant="body2" color="text.secondary">
            Download partner-facing guides and printable registration forms. Forms are filled
            by hand, then used to register the partner / vehicle / driver in the portal.
          </Typography>
        </Box>
        <Chip icon={<VerifiedUser />} label="Invoice-style platform header" color="primary" variant="outlined" />
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        How it works: download a guide to hand to the partner (so they know what to prepare),
        and download the matching form to fill by hand. Use the filled form to register the
        partner, then add their vehicles and drivers — each form carries the required fields.
      </Alert>

      <Typography variant="subtitle2" sx={{ mb: 1.5, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 12, fontWeight: 700 }}>
        Guides — what the partner must prepare
      </Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {DOC_CARDS.filter((c) => c.kind === "guide").map((card) => (
          <DocCardView key={card.key} card={card} downloading={downloading} onDownload={handleDownload} />
        ))}
      </Grid>

      <Typography variant="subtitle2" sx={{ mb: 1.5, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 12, fontWeight: 700 }}>
        Forms — printable & hand-fillable
      </Typography>
      <Grid container spacing={2}>
        {DOC_CARDS.filter((c) => c.kind === "form").map((card) => (
          <DocCardView key={card.key} card={card} downloading={downloading} onDownload={handleDownload} />
        ))}
      </Grid>
    </Box>
  );
}

function DocCardView({
  card,
  downloading,
  onDownload,
}: {
  card: DocCard;
  downloading: string | null;
  onDownload: (card: DocCard) => void;
}) {
  const busy = downloading === card.key;
  return (
    <Grid item xs={12} sm={6} lg={4}>
      <Card variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <CardHeader
          avatar={
            <Box
              sx={{
                width: 44, height: 44, borderRadius: 2,
                background: card.accent, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {card.icon}
            </Box>
          }
          title={
            <Typography variant="subtitle1" fontWeight={700}>{card.title}</Typography>
          }
          subheader={
            <Chip
              size="small"
              icon={<PictureAsPdf sx={{ fontSize: 14 }} />}
              label={card.kind === "guide" ? "Guide · PDF" : "Form · PDF"}
              variant="outlined"
              color={card.kind === "guide" ? "primary" : "success"}
              sx={{ mt: 0.5 }}
            />
          }
        />
        <CardContent sx={{ flex: 1, display: "flex", flexDirection: "column", pt: 0 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {card.subtitle}
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Tooltip title={card.kind === "form" ? "Fill by hand, then register in the portal" : "Share with the partner to prepare"}>
            <Button
              variant="contained"
              fullWidth
              startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <Download />}
              disabled={downloading !== null}
              onClick={() => onDownload(card)}
              sx={{ mt: "auto" }}
            >
              {busy ? "Downloading…" : "Download PDF"}
            </Button>
          </Tooltip>
        </CardContent>
      </Card>
    </Grid>
  );
}