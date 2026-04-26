import { useRef, useState } from 'react';
import api from '../lib/api';
import { Upload, Image as ImageIcon, X } from 'lucide-react';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

interface Props {
  /** Current image URL (relative `/uploads/...` or absolute) */
  value?: string | null;
  /** Called with the new server-side URL once upload succeeds */
  onChange: (imageUrl: string) => void;
  /** Cleared when the user removes the image */
  onClear?: () => void;
  /** Backend endpoint that accepts a multipart `image` field */
  uploadUrl: string;
  /** Optional fixed height (px) for the preview area */
  height?: number;
  label?: string;
}

export default function ImageUploader({
  value,
  onChange,
  onClear,
  uploadUrl,
  height = 200,
  label = 'Image',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const validate = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Invalid type. Allowed: JPG, PNG, WEBP, GIF`;
    }
    if (file.size > MAX_SIZE) {
      return `File too large (max ${MAX_SIZE / 1024 / 1024} MB)`;
    }
    return null;
  };

  const upload = async (file: File) => {
    const v = validate(file);
    if (v) { setError(v); return; }
    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { data } = await api.post(uploadUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange(data.imageUrl);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  };

  const previewSrc = value && !value.startsWith('http') ? value : value || '';

  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={onFileChange}
        className="hidden"
      />
      <div
        className={`relative border-2 border-dashed rounded-lg overflow-hidden transition-colors cursor-pointer ${
          dragOver
            ? 'border-[#D4AF37] bg-[#D4AF37]/10'
            : value
            ? 'border-[#334155]'
            : 'border-[#334155] hover:border-[#D4AF37]/50'
        }`}
        style={{ height }}
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {value ? (
          <>
            <img
              src={previewSrc}
              alt="preview"
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            {onClear && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onClear(); setError(''); }}
                className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-500/80 rounded-full text-white"
                title="Remove image"
              >
                <X size={14} />
              </button>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            {uploading ? (
              <>
                <div className="w-7 h-7 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mb-2" />
                <span className="text-sm">Uploading…</span>
              </>
            ) : (
              <>
                <Upload size={28} className="mb-2" />
                <span className="text-sm">Drag & drop or click to choose an image</span>
                <span className="text-xs text-gray-600 mt-1">JPG, PNG, WEBP, GIF — max 5 MB</span>
              </>
            )}
          </div>
        )}

        {/* Overlay spinner when uploading replaces an existing image */}
        {uploading && value && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="w-7 h-7 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      {error && (
        <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
          <ImageIcon size={12} /> {error}
        </p>
      )}
    </div>
  );
}
