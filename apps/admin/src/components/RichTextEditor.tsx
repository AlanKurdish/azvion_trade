import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import api from '../lib/api';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Code,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Link as LinkIcon, Image as ImageIcon, Undo, Redo, Minus,
} from 'lucide-react';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  /** When provided, the image toolbar button opens a file picker and uploads
   * the chosen file to this endpoint instead of prompting for a URL. */
  imageUploadUrl?: string;
}

export default function RichTextEditor({ value, onChange, placeholder = 'Write something…', minHeight = 240, imageUploadUrl }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-[#D4AF37] underline' },
      }),
      Image.configure({
        HTMLAttributes: { class: 'rounded-lg max-w-full' },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // TipTap returns "<p></p>" for empty content — normalise to ''
      onChange(html === '<p></p>' ? '' : html);
    },
    editorProps: {
      attributes: {
        class: 'rte-content focus:outline-none px-4 py-3',
        style: `min-height: ${minHeight}px;`,
      },
    },
  });

  if (!editor) {
    return (
      <div className="bg-[#0f172a] border border-[#334155] rounded-lg" style={{ minHeight }} />
    );
  }

  return (
    <div className="bg-[#0f172a] border border-[#334155] rounded-lg overflow-hidden">
      <Toolbar editor={editor} imageUploadUrl={imageUploadUrl} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor, imageUploadUrl }: { editor: Editor; imageUploadUrl?: string }) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const promptForLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt(t('rte.linkPrompt'), previous ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const onImageButtonClick = () => {
    if (imageUploadUrl) {
      fileInputRef.current?.click();
    } else {
      const url = window.prompt(t('rte.imageUrlPrompt'), 'https://');
      if (!url) return;
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const onImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !imageUploadUrl) return;
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { data } = await api.post(imageUploadUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      editor.chain().focus().setImage({ src: data.imageUrl }).run();
    } catch (err: any) {
      window.alert(err.response?.data?.message || t('rte.imageUploadFailed'));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-[#334155] bg-[#1a253b]">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={onImageSelected}
        className="hidden"
      />
      <Btn label={t('rte.bold')} onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}><Bold size={14} /></Btn>
      <Btn label={t('rte.italic')} onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}><Italic size={14} /></Btn>
      <Btn label={t('rte.underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')}><UnderlineIcon size={14} /></Btn>
      <Btn label={t('rte.strike')} onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')}><Strikethrough size={14} /></Btn>

      <Sep />

      <Btn label={t('rte.h1')} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })}><Heading1 size={14} /></Btn>
      <Btn label={t('rte.h2')} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}><Heading2 size={14} /></Btn>
      <Btn label={t('rte.h3')} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })}><Heading3 size={14} /></Btn>

      <Sep />

      <Btn label={t('rte.bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')}><List size={14} /></Btn>
      <Btn label={t('rte.numberedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')}><ListOrdered size={14} /></Btn>
      <Btn label={t('rte.quote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')}><Quote size={14} /></Btn>
      <Btn label={t('rte.codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')}><Code size={14} /></Btn>
      <Btn label={t('rte.horizontalRule')} onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus size={14} /></Btn>

      <Sep />

      <Btn label={t('rte.alignLeft')} onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })}><AlignLeft size={14} /></Btn>
      <Btn label={t('rte.alignCenter')} onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })}><AlignCenter size={14} /></Btn>
      <Btn label={t('rte.alignRight')} onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })}><AlignRight size={14} /></Btn>
      <Btn label={t('rte.justify')} onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })}><AlignJustify size={14} /></Btn>

      <Sep />

      <Btn label={t('rte.link')} onClick={promptForLink} active={editor.isActive('link')}><LinkIcon size={14} /></Btn>
      <Btn label={imageUploadUrl ? t('rte.imageUpload') : t('rte.imageUrl')} onClick={onImageButtonClick}><ImageIcon size={14} /></Btn>

      <Sep />

      <Btn label={t('rte.undo')} onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}><Undo size={14} /></Btn>
      <Btn label={t('rte.redo')} onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}><Redo size={14} /></Btn>
    </div>
  );
}

interface BtnProps {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

function Btn({ label, onClick, active, disabled, children }: BtnProps) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`p-1.5 rounded transition-colors disabled:opacity-30 ${
        active ? 'bg-[#D4AF37] text-black' : 'text-gray-300 hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-5 bg-[#334155] mx-0.5" />;
}
