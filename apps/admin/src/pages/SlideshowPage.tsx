import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import { Plus, Pencil, Trash2, X, Eye, EyeOff, Upload, ImageIcon } from 'lucide-react';

interface Slide {
  id: string;
  title: string;
  imageUrl: string;
  description: string | null;
  link: string | null;
  order: number;
  isActive: boolean;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const emptyForm = { title: '', imageUrl: '', description: '', link: '', order: 0, isActive: true };

export default function SlideshowPage() {
  const { t } = useTranslation();
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Slide | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const loadSlides = async () => {
    try {
      const { data } = await api.get('/slideshow/all');
      setSlides(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSlides(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, order: slides.length });
    setPreviewUrl(null);
    setUploadError('');
    setShowForm(true);
  };

  const openEdit = (slide: Slide) => {
    setEditing(slide);
    setForm({
      title: slide.title,
      imageUrl: slide.imageUrl,
      description: slide.description || '',
      link: slide.link || '',
      order: slide.order,
      isActive: slide.isActive,
    });
    setPreviewUrl(slide.imageUrl);
    setUploadError('');
    setShowForm(true);
  };

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return t('slideshow.invalidType');
    }
    if (file.size > MAX_SIZE) {
      return t('slideshow.fileTooLarge');
    }
    return null;
  };

  const uploadFile = async (file: File) => {
    const error = validateFile(file);
    if (error) {
      setUploadError(error);
      return;
    }

    setUploadError('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const { data } = await api.post('/slideshow/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setForm((prev) => ({ ...prev, imageUrl: data.imageUrl }));
      setPreviewUrl(data.imageUrl);
    } catch (err: any) {
      setUploadError(err.response?.data?.message || t('slideshow.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    // Reset so same file can be selected again
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.imageUrl) {
      setUploadError(t('slideshow.imageRequired'));
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/slideshow/${editing.id}`, form);
      } else {
        await api.post('/slideshow', form);
      }
      setShowForm(false);
      loadSlides();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('slideshow.confirmDelete'))) return;
    try {
      await api.delete(`/slideshow/${id}`);
      loadSlides();
    } catch {
      // ignore
    }
  };

  const toggleActive = async (slide: Slide) => {
    try {
      await api.patch(`/slideshow/${slide.id}`, { isActive: !slide.isActive });
      loadSlides();
    } catch {
      // ignore
    }
  };

  /** Resolve image URL for display */
  const resolveImage = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    // Relative path like /uploads/slideshow/xxx.jpg — prefix with API origin in dev
    return url;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">{t('slideshow.title')}</h2>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-[#D4AF37] text-black font-semibold rounded-lg hover:bg-[#c5a030]"
        >
          <Plus size={16} /> {t('slideshow.addSlide')}
        </button>
      </div>

      {slides.length === 0 ? (
        <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-12 text-center text-gray-400">
          {t('slideshow.noSlides')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {slides.map((slide) => (
            <div
              key={slide.id}
              className={`bg-[#1e293b] rounded-xl border ${slide.isActive ? 'border-[#334155]' : 'border-red-500/30'} overflow-hidden`}
            >
              {/* Image Preview */}
              <div className="h-40 bg-[#0f172a] relative overflow-hidden">
                {slide.imageUrl ? (
                  <img
                    src={resolveImage(slide.imageUrl)}
                    alt={slide.title}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-600">
                    <ImageIcon size={40} />
                  </div>
                )}
                {!slide.isActive && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-red-500/80 text-white text-xs rounded">
                    {t('slideshow.inactive')}
                  </div>
                )}
                <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                  #{slide.order}
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-semibold text-white mb-1">{slide.title}</h3>
                {slide.description && (
                  <p className="text-gray-400 text-sm mb-2 line-clamp-2">{slide.description}</p>
                )}
                {slide.link && (
                  <p className="text-[#D4AF37] text-xs truncate mb-3">{slide.link}</p>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleActive(slide)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs ${
                      slide.isActive
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                    }`}
                  >
                    {slide.isActive ? <Eye size={12} /> : <EyeOff size={12} />}
                    {slide.isActive ? t('slideshow.active') : t('slideshow.inactive')}
                  </button>
                  <button
                    onClick={() => openEdit(slide)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded text-xs hover:bg-blue-500/30"
                  >
                    <Pencil size={12} /> {t('slideshow.edit')}
                  </button>
                  <button
                    onClick={() => handleDelete(slide.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/30"
                  >
                    <Trash2 size={12} /> {t('slideshow.delete')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">
                {editing ? t('slideshow.editSlide') : t('slideshow.addSlide')}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('slideshow.slideTitle')}</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-4 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-white"
                  placeholder={t('slideshow.titleOptional')}
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('slideshow.image')}</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {/* Drop zone / Preview */}
                <div
                  className={`relative border-2 border-dashed rounded-lg overflow-hidden transition-colors cursor-pointer ${
                    dragOver
                      ? 'border-[#D4AF37] bg-[#D4AF37]/10'
                      : previewUrl
                      ? 'border-[#334155]'
                      : 'border-[#334155] hover:border-[#D4AF37]/50'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  {previewUrl ? (
                    <div className="relative">
                      <img
                        src={resolveImage(previewUrl)}
                        alt="Preview"
                        className="w-full h-40 object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = ''; }}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="text-white text-sm flex items-center gap-2">
                          <Upload size={16} /> {t('slideshow.changeImage')}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-10 flex flex-col items-center justify-center text-gray-400">
                      {uploading ? (
                        <>
                          <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mb-2" />
                          <span className="text-sm">{t('slideshow.uploading')}</span>
                        </>
                      ) : (
                        <>
                          <Upload size={28} className="mb-2 text-gray-500" />
                          <span className="text-sm">{t('slideshow.dropOrClick')}</span>
                          <span className="text-xs text-gray-600 mt-1">JPG, PNG, WebP, GIF — max 5MB</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {uploadError && (
                  <p className="text-red-400 text-xs mt-1">{uploadError}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('slideshow.description')}</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-white"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('slideshow.link')}</label>
                <input
                  value={form.link}
                  onChange={(e) => setForm({ ...form, link: e.target.value })}
                  className="w-full px-4 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-white"
                  placeholder="https://..."
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-gray-400 mb-1">{t('slideshow.order')}</label>
                  <input
                    type="number"
                    value={form.order}
                    onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-white"
                  />
                </div>
                <div className="flex-1 flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      className="w-4 h-4 rounded border-[#334155] accent-[#D4AF37]"
                    />
                    <span className="text-sm text-gray-300">{t('slideshow.active')}</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-gray-300 hover:text-white"
                >
                  {t('slideshow.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="flex-1 px-4 py-2 bg-[#D4AF37] text-black font-semibold rounded-lg hover:bg-[#c5a030] disabled:opacity-50"
                >
                  {saving ? t('slideshow.saving') : editing ? t('slideshow.save') : t('slideshow.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
