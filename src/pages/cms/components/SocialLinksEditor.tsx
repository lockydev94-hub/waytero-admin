// ============================================================
// WAYTERO ADMIN — SOCIAL LINKS EDITOR
// Doc Ref: Migration 0044_website_cms
//
//  Compact editor for the social_links dict used by header & footer.
//  Always shows the seven canonical platforms; an empty string hides it
//  on the rendered website.
// ============================================================

import {
  Box, Card, CardContent, Stack, TextField, Typography, alpha, useTheme,
} from "@mui/material";
import {
  Facebook, Instagram, Twitter, LinkedIn, YouTube, WhatsApp, Language,
} from "@mui/icons-material";

import type { SocialLinks } from "../../../services/cms.service";

interface Props {
  value: SocialLinks;
  onChange: (next: SocialLinks) => void;
}

const FIELDS: Array<{
  key: keyof SocialLinks;
  label: string;
  placeholder: string;
  icon: React.ReactNode;
}> = [
  { key: "facebook",  label: "Facebook",  placeholder: "https://facebook.com/waytero",   icon: <Facebook fontSize="small" /> },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/waytero",  icon: <Instagram fontSize="small" /> },
  { key: "twitter",   label: "Twitter / X", placeholder: "https://twitter.com/waytero",  icon: <Twitter fontSize="small" /> },
  { key: "linkedin",  label: "LinkedIn",  placeholder: "https://linkedin.com/company/waytero", icon: <LinkedIn fontSize="small" /> },
  { key: "youtube",   label: "YouTube",   placeholder: "https://youtube.com/@waytero",   icon: <YouTube fontSize="small" /> },
  { key: "whatsapp",  label: "WhatsApp",  placeholder: "https://wa.me/919999999999",     icon: <WhatsApp fontSize="small" /> },
  { key: "website",   label: "Other / Website", placeholder: "https://…",                icon: <Language fontSize="small" /> },
];

export default function SocialLinksEditor({ value, onChange }: Props) {
  const theme = useTheme();
  const v = value ?? {};

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={700} mb={1}>
        Social links
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
        Leave a field empty to hide that platform on the rendered site.
      </Typography>
      <Stack spacing={1}>
        {FIELDS.map((f) => (
          <Card key={f.key} variant="outlined" sx={{ borderColor: alpha(theme.palette.divider, 0.6), borderRadius: 2 }}>
            <CardContent sx={{ display: "flex", alignItems: "center", gap: 1, py: 1, "&:last-child": { pb: 1 } }}>
              <Box sx={{ color: "text.secondary", display: "flex", alignItems: "center" }}>{f.icon}</Box>
              <TextField
                size="small"
                label={f.label}
                placeholder={f.placeholder}
                value={v[f.key] ?? ""}
                onChange={(e) => onChange({ ...v, [f.key]: e.target.value })}
                sx={{ flex: 1 }}
              />
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}
