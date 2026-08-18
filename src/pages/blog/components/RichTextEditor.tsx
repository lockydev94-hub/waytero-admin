// ============================================================
// WAYTERO ADMIN — RICH TEXT EDITOR (Quill)
// Doc Ref: Blog System §5 — Rich Text Editor
//
//  Wraps react-quill-new with WayTero styling and image upload
//  integration. Used in the Blog Editor for post content.
//
//  Toolbar includes:
//    • Headings (H2, H3)
//    • Bold, Italic, Underline, Strike
//    • Lists (ordered, bullet)
//    • Blockquote, Code block
//    • Link, Image (via Cloudinary upload)
//    • Clean formatting
// ============================================================

import { useEffect, useMemo, useRef, useCallback } from "react";
import { useTheme } from "@mui/material";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

import { uploadMedia } from "../../../services/settings.service";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Write your content here...",
  minHeight = 350,
}: RichTextEditorProps) {
  const theme = useTheme();
  const quillRef = useRef<ReactQuill>(null);
  // Tracks the last HTML value the editor reported (via onChange). Used to
  // distinguish programmatic/external value changes from user input so that
  // loading a post from the API updates the editor without fighting typing.
  const lastEmittedRef = useRef<string | null>(null);

  // Reflect external value changes (e.g. async-loaded post content) into the
  // editor. react-quill's controlled `value` prop is unreliable for values
  // that arrive after mount, so we apply them directly via the Quill API.
  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    const editor = quillRef.current?.getEditor();
    if (!editor) return;
    editor.setContents(editor.clipboard.convert({ html: value || "" }));
  }, [value]);

  const handleChange = useCallback(
    (html: string) => {
      lastEmittedRef.current = html;
      onChange(html);
    },
    [onChange]
  );

  const imageHandler = useCallback(() => {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        const result = await uploadMedia(file, "general", {
          folderOverride: "waytero/blog",
        });
        const quill = quillRef.current?.getEditor();
        if (quill) {
          const range = quill.getSelection(true);
          quill.insertEmbed(range.index, "image", result.secure_url);
          quill.setSelection(range.index + 1);
        }
      } catch {
        // Silently fail — the user can retry
      }
    };
  }, []);

  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [2, 3, false] }],
          ["bold", "italic", "underline", "strike"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["blockquote", "code-block"],
          ["link", "image"],
          ["clean"],
        ],
        handlers: {
          image: imageHandler,
        },
      },
    }),
    [imageHandler]
  );

  const formats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "list",
    "bullet",
    "blockquote",
    "code-block",
    "link",
    "image",
  ];

  return (
    <div
      className="rich-text-editor"
      style={{
        "--quill-bg": theme.palette.background.paper,
        "--quill-color": theme.palette.text.primary,
        "--quill-border": theme.palette.divider,
        "--quill-toolbar-bg": theme.palette.mode === "dark" ? "#1E293B" : "#F8FAFC",
        minHeight,
      } as React.CSSProperties}
    >
      <style>{`
        .rich-text-editor .ql-toolbar {
          background: var(--quill-toolbar-bg);
          border: 1px solid var(--quill-border);
          border-radius: 8px 8px 0 0;
          font-family: inherit;
        }
        .rich-text-editor .ql-container {
          border: 1px solid var(--quill-border);
          border-top: 0;
          border-radius: 0 0 8px 8px;
          background: var(--quill-bg);
          color: var(--quill-color);
          font-family: inherit;
          font-size: 15px;
          line-height: 1.7;
          min-height: ${minHeight}px;
        }
        .rich-text-editor .ql-editor {
          min-height: ${minHeight}px;
          padding: 16px 20px;
        }
        .rich-text-editor .ql-editor.ql-blank::before {
          color: ${theme.palette.text.disabled};
          font-style: normal;
        }
        .rich-text-editor .ql-editor h2 { font-size: 1.5rem; font-weight: 700; margin: 1.5rem 0 0.75rem; }
        .rich-text-editor .ql-editor h3 { font-size: 1.25rem; font-weight: 600; margin: 1.25rem 0 0.5rem; }
        .rich-text-editor .ql-editor p { margin: 0 0 0.75rem; }
        .rich-text-editor .ql-editor blockquote {
          border-left: 3px solid ${theme.palette.primary.main};
          background: ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"};
          padding: 8px 16px;
          margin: 1rem 0;
          border-radius: 0 4px 4px 0;
        }
        .rich-text-editor .ql-editor pre.ql-syntax {
          background: ${theme.palette.mode === "dark" ? "#0F172A" : "#1E293B"};
          color: #E2E8F0;
          border-radius: 8px;
          padding: 12px 16px;
          overflow-x: auto;
          font-size: 13px;
        }
        .rich-text-editor .ql-editor img {
          max-width: 100%;
          border-radius: 8px;
          margin: 1rem 0;
        }
        .rich-text-editor .ql-editor a {
          color: ${theme.palette.primary.main};
          text-decoration: underline;
        }
      `}</style>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        defaultValue={value}
        onChange={handleChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
      />
    </div>
  );
}