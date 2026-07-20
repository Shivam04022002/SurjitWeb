import { useCallback, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Youtube from '@tiptap/extension-youtube'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { Box, Divider, IconButton, Tooltip, Paper, CircularProgress } from '@mui/material'
import {
  FormatBold, FormatItalic, FormatUnderlined, FormatListBulleted, FormatListNumbered,
  FormatQuote, Code, InsertLink, LinkOff, Image as ImageIcon, TableChart, Undo, Redo,
  FormatAlignLeft, FormatAlignCenter, FormatAlignRight, FormatAlignJustify, OndemandVideo,
  HorizontalRule, Title
} from '@mui/icons-material'
import { useRef, useState } from 'react'
import { blogService } from '../services/blog.service'

// Declared at module scope: defining this inside the editor would make React
// treat it as a new component type on every keystroke and remount every
// button, losing focus and hover state.
const Btn = ({ title, icon: Icon, onClick, active, disabled }) => (
  <Tooltip title={title}>
    <span>
      <IconButton
        size="small"
        onClick={onClick}
        disabled={disabled}
        color={active ? 'primary' : 'default'}
        sx={{ bgcolor: active ? 'action.selected' : 'transparent' }}
      >
        {Icon ? <Icon fontSize="small" /> : null}
      </IconButton>
    </span>
  </Tooltip>
)

// StarterKit already ships Link, Underline, Blockquote, CodeBlock, headings,
// lists and history, so only the extras are registered separately.
const buildExtensions = () => [
  StarterKit.configure({
    heading: { levels: [2, 3, 4] },
    link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer' } }
  }),
  Image.configure({ HTMLAttributes: { loading: 'lazy' } }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Youtube.configure({ controls: true, nocookie: true, width: 640, height: 360 }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell
]

const RichTextEditor = ({ value, onChange, showToast }) => {
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  const editor = useEditor({
    extensions: buildExtensions(),
    content: value || '',
    onUpdate: ({ editor: e }) => onChange(e.getHTML())
  })

  // Loading an existing blog fills the field after the editor mounts, so the
  // content is pushed in once when it arrives. Guarded on equality, otherwise
  // every keystroke would reset the cursor to the start.
  useEffect(() => {
    if (!editor) return
    const incoming = value || ''
    if (incoming !== editor.getHTML()) {
      editor.commands.setContent(incoming, { emitUpdate: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, value])

  const setLink = useCallback(() => {
    if (!editor) return
    const previous = editor.getAttributes('link').href
    const url = window.prompt('Link URL', previous || 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  const addVideo = useCallback(() => {
    if (!editor) return
    const url = window.prompt('Video URL (YouTube)')
    if (url) editor.commands.setYoutubeVideo({ src: url })
  }, [editor])

  // Inline images go through the same upload service as every other module,
  // so they land in S3 rather than being embedded as base64 in the content.
  const handleImageFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !editor) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await blogService.uploadInlineImage(fd)
      editor.chain().focus().setImage({ src: res.data.image.url, alt: file.name }).run()
    } catch (err) {
      showToast?.(err?.response?.data?.message || 'Image upload failed', 'error')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (!editor) return null

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25, p: 1, bgcolor: 'grey.50', alignItems: 'center' }}>
        <Btn title="Heading 2" icon={Title} active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <Btn title="Heading 3" icon={Title} active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Btn title="Bold" icon={FormatBold} active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()} />
        <Btn title="Italic" icon={FormatItalic} active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()} />
        <Btn title="Underline" icon={FormatUnderlined} active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()} />
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Btn title="Bullet list" icon={FormatListBulleted} active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <Btn title="Numbered list" icon={FormatListNumbered} active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <Btn title="Block quote" icon={FormatQuote} active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        <Btn title="Code block" icon={Code} active={editor.isActive('codeBlock')}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()} />
        <Btn title="Divider" icon={HorizontalRule}
          onClick={() => editor.chain().focus().setHorizontalRule().run()} />
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Btn title="Align left" icon={FormatAlignLeft} active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()} />
        <Btn title="Align centre" icon={FormatAlignCenter} active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()} />
        <Btn title="Align right" icon={FormatAlignRight} active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()} />
        <Btn title="Justify" icon={FormatAlignJustify} active={editor.isActive({ textAlign: 'justify' })}
          onClick={() => editor.chain().focus().setTextAlign('justify').run()} />
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Btn title="Add link" icon={InsertLink} active={editor.isActive('link')} onClick={setLink} />
        <Btn title="Remove link" icon={LinkOff} disabled={!editor.isActive('link')}
          onClick={() => editor.chain().focus().unsetLink().run()} />
        <Btn title={uploading ? 'Uploading…' : 'Insert image'} icon={uploading ? undefined : ImageIcon}
          disabled={uploading} onClick={() => fileInputRef.current?.click()} />
        {uploading && <CircularProgress size={16} sx={{ mx: 1 }} />}
        <Btn title="Insert video" icon={OndemandVideo} onClick={addVideo} />
        <Btn title="Insert table" icon={TableChart}
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Btn title="Undo" icon={Undo} disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()} />
        <Btn title="Redo" icon={Redo} disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()} />

        <input ref={fileInputRef} type="file" hidden accept="image/*" onChange={handleImageFile} />
      </Box>

      <Divider />

      <Box
        sx={{
          p: 2, minHeight: 380,
          '& .ProseMirror': { outline: 'none', minHeight: 340 },
          '& .ProseMirror p.is-editor-empty:first-of-type::before': {
            content: 'attr(data-placeholder)', float: 'left', color: 'text.disabled', pointerEvents: 'none', height: 0
          },
          '& .ProseMirror img': { maxWidth: '100%', height: 'auto', borderRadius: 1 },
          '& .ProseMirror table': { borderCollapse: 'collapse', width: '100%', margin: '12px 0' },
          '& .ProseMirror th, & .ProseMirror td': { border: '1px solid', borderColor: 'divider', p: 1 },
          '& .ProseMirror th': { bgcolor: 'grey.100', fontWeight: 600 },
          '& .ProseMirror blockquote': { borderLeft: '3px solid', borderColor: 'primary.main', pl: 2, ml: 0, color: 'text.secondary' },
          '& .ProseMirror pre': { bgcolor: 'grey.900', color: 'grey.100', p: 1.5, borderRadius: 1, overflowX: 'auto' },
          '& .ProseMirror iframe': { maxWidth: '100%', border: 0 }
        }}
      >
        <EditorContent editor={editor} />
      </Box>
    </Paper>
  )
}

export default RichTextEditor
