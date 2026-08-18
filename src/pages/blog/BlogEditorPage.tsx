// ============================================================
// WAYTERO ADMIN — BLOG EDITOR PAGE
// Doc Ref: Blog System §4 — Admin Portal
//
//  Route: /cms/blog/new  |  /cms/blog/:id
//
//  Full blog post editor with:
//    • Title, slug (auto-generated from title)
//    • Rich text editor (Quill) for content
//    • Featured image upload (via MediaUploader)
//    • Author name + avatar
//    • Tags (comma-separated input)
//    • SEO fields (title, description, keywords)
//    • Publish toggle
//    • Save as draft or publish
// ============================================================

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Card, CardContent, Stack, Typography, TextField, Button,
  CircularProgress, Switch, FormControlLabel, Grid, Chip, IconButton, Tooltip,
} from "@mui/material";
import {
  Save, ArrowBack, Delete, Refresh,
} from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import { blogService, BlogPost } from "../../services/cms.service";
import { apiErrorMessage } from "../../utils/apiError";
import MediaUploader, { CropSpec } from "../cms/components/MediaUploader";
import RichTextEditor from "./components/RichTextEditor";

// Featured image: 16:9 landscape — good for blog cards and hero
const FEATURED_IMAGE_CROP: CropSpec = {
  aspectRatio: 16 / 9,
  outputWidth: 960,
  outputHeight: 540,
};

// Author avatar: 1:1 square
const AVATAR_CROP: CropSpec = {
  aspectRatio: 1,
  outputWidth: 256,
  outputHeight: 256,
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 300);
}

export default function BlogEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new" || !id;
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [featuredImageUrl, setFeaturedImageUrl] = useState<string | null>(null);
  const [authorName, setAuthorName] = useState("");
  const [authorAvatarUrl, setAuthorAvatarUrl] = useState<string | null>(null);
  const [tagsText, setTagsText] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");

  // Rich text editor ref

  // Load existing post
  const { data: post, isLoading: loadingPost } = useQuery({
    queryKey: ["blog-post", id],
    queryFn: () => blogService.getPost(Number(id)),
    enabled: !isNew,
  });

  // Populate form when post loads
  useEffect(() => {
    if (post) {
      setTitle(post.title);
      setSlug(post.slug);
      setSlugManuallyEdited(true);
      setExcerpt(post.excerpt || "");
      setContent(post.content || "");
      setFeaturedImageUrl(post.featured_image_url);
      setAuthorName(post.author_name || "");
      setAuthorAvatarUrl(post.author_avatar_url);
      setTagsText((post.tags || []).join(", "));
      setIsPublished(post.is_published);
      setSeoTitle(post.seo_title || "");
      setSeoDescription(post.seo_description || "");
      setSeoKeywords(post.seo_keywords || "");
    }
  }, [post]);

  // Auto-slug from title
  const handleTitleChange = useCallback(
    (val: string) => {
      setTitle(val);
      if (!slugManuallyEdited) {
        setSlug(slugify(val));
      }
    },
    [slugManuallyEdited]
  );

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (payload: any) =>
      isNew ? blogService.createPost(payload) : blogService.updatePost(Number(id), payload),
    onSuccess: (saved) => {
      enqueueSnackbar(isNew ? "Post created" : "Post saved", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["blog-posts"] });
      if (isNew) {
        navigate(`/cms/blog/${saved.id}`, { replace: true });
      }
    },
    onError: (err) => {
      enqueueSnackbar(apiErrorMessage(err, "Failed to save"), { variant: "error" });
    },
  });

  const handleSave = (publish?: boolean) => {
    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload: any = {
      title,
      slug,
      excerpt: excerpt || null,
      content: content || null,
      featured_image_url: featuredImageUrl,
      author_name: authorName || null,
      author_avatar_url: authorAvatarUrl,
      tags: tags.length > 0 ? tags : undefined,
      is_published: publish ?? isPublished,
      seo_title: seoTitle || null,
      seo_description: seoDescription || null,
      seo_keywords: seoKeywords || null,
    };

    saveMutation.mutate(payload);
  };

  if (!isNew && loadingPost) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton onClick={() => navigate("/cms/blog")}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4" fontWeight={700}>
            {isNew ? "New Blog Post" : "Edit Blog Post"}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<Save />}
            onClick={() => handleSave(false)}
            disabled={saveMutation.isPending}
          >
            Save Draft
          </Button>
          <Button
            variant="contained"
            startIcon={saveMutation.isPending ? <CircularProgress size={16} /> : <Save />}
            onClick={() => handleSave(true)}
            disabled={saveMutation.isPending}
          >
            {isPublished ? "Update" : "Publish"}
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={3}>
        {/* Main content */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Stack spacing={3}>
                {/* Title */}
                <TextField
                  label="Title"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  fullWidth
                  required
                  placeholder="Enter blog post title..."
                />

                {/* Slug */}
                <TextField
                  label="Slug"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugManuallyEdited(true);
                  }}
                  fullWidth
                  required
                  helperText="URL-friendly identifier. Auto-generated from title."
                  placeholder="my-blog-post"
                  InputProps={{
                    endAdornment: (
                      <Tooltip title="Regenerate from title">
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => {
                            setSlug(slugify(title));
                            setSlugManuallyEdited(false);
                          }}
                        >
                          <Refresh fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ),
                  }}
                />

                {/* Excerpt */}
                <TextField
                  label="Excerpt"
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="Brief summary for blog cards and SEO..."
                />

                {/* Rich Text Editor */}
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    Content
                  </Typography>
                  <RichTextEditor
                    value={content}
                    onChange={setContent}
                    placeholder="Write your blog post content here..."
                    minHeight={400}
                  />
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {/* SEO */}
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                SEO Settings
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label="SEO Title"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  fullWidth
                  placeholder="Custom title for search engines"
                  helperText={`${seoTitle.length}/300 characters`}
                  inputProps={{ maxLength: 300 }}
                />
                <TextField
                  label="SEO Description"
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="Meta description for search results"
                  helperText={`${seoDescription.length}/500 characters`}
                  inputProps={{ maxLength: 500 }}
                />
                <TextField
                  label="SEO Keywords"
                  value={seoKeywords}
                  onChange={(e) => setSeoKeywords(e.target.value)}
                  fullWidth
                  placeholder="Comma-separated keywords"
                  helperText={`${seoKeywords.length}/500 characters`}
                  inputProps={{ maxLength: 500 }}
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} lg={4}>
          {/* Publish status */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                Publish Settings
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                  />
                }
                label={isPublished ? "Published" : "Draft"}
              />
            </CardContent>
          </Card>

          {/* Featured Image */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                Featured Image
              </Typography>
              {featuredImageUrl ? (
                <Box sx={{ position: "relative", mb: 2 }}>
                  <Box
                    component="img"
                    src={featuredImageUrl}
                    alt="Featured"
                    sx={{
                      width: "100%",
                      height: 180,
                      objectFit: "cover",
                      borderRadius: 1,
                    }}
                  />
                  <IconButton
                    size="small"
                    sx={{ position: "absolute", top: 4, right: 4, bgcolor: "background.paper" }}
                    onClick={() => setFeaturedImageUrl(null)}
                  >
                    <Delete />
                  </IconButton>
                </Box>
              ) : (
                <MediaUploader
                  value={featuredImageUrl}
                  onChange={(url) => setFeaturedImageUrl(url)}
                  folder="waytero/blog/featured"
                  kind="image"
                  crop={FEATURED_IMAGE_CROP}
                  label="Upload featured image"
                  hint="16:9 landscape recommended"
                />
              )}
            </CardContent>
          </Card>

          {/* Author */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                Author
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label="Author Name"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  fullWidth
                  placeholder="e.g. Priya Sharma"
                />
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                    Author Avatar
                  </Typography>
                  {authorAvatarUrl ? (
                    <Box sx={{ position: "relative", display: "inline-block" }}>
                      <Box
                        component="img"
                        src={authorAvatarUrl}
                        alt="Avatar"
                        sx={{
                          width: 64,
                          height: 64,
                          borderRadius: "50%",
                          objectFit: "cover",
                        }}
                      />
                      <IconButton
                        size="small"
                        sx={{ position: "absolute", top: -4, right: -4, bgcolor: "background.paper" }}
                        onClick={() => setAuthorAvatarUrl(null)}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  ) : (
                    <MediaUploader
                      value={authorAvatarUrl}
                      onChange={(url) => setAuthorAvatarUrl(url)}
                      folder="waytero/blog/authors"
                      kind="image"
                      crop={AVATAR_CROP}
                      label="Upload author avatar"
                      hint="1:1 square"
                    />
                  )}
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                Tags
              </Typography>
              <TextField
                label="Tags"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                fullWidth
                placeholder="travel, tips, india"
                helperText="Comma-separated tags"
              />
              {tagsText && (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 1 }}>
                  {tagsText
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .map((t) => (
                      <Chip key={t} label={t} size="small" variant="outlined" />
                    ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}