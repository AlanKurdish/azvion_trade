import { useEffect, useState } from 'react';
import api from '../lib/api';
import { FileText, Pencil, Plus, Trash2, X } from 'lucide-react';
import RichTextEditor from '../components/RichTextEditor';

interface Post {
  id: string;
  title: string;
  content: string;
  imageUrl?: string | null;
  isPublished: boolean;
  publishedAt: string;
}

const empty = { title: '', content: '', imageUrl: '', isPublished: true };

export default function BlogPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const { data } = await api.get('/blog/admin/all');
      setPosts(data);
    } catch {}
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(empty); setError(''); setShowForm(true); };
  const openEdit = (p: Post) => {
    setEditing(p);
    setForm({ title: p.title, content: p.content, imageUrl: p.imageUrl || '', isPublished: p.isPublished });
    setError(''); setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim() || !form.content.trim()) {
      return setError('Title and content are required');
    }
    setSaving(true);
    try {
      const payload: any = {
        title: form.title.trim(),
        content: form.content,
        isPublished: form.isPublished,
      };
      if (form.imageUrl.trim()) payload.imageUrl = form.imageUrl.trim();

      if (editing) {
        await api.patch(`/blog/${editing.id}`, payload);
      } else {
        await api.post('/blog', payload);
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: Post) => {
    if (!confirm(`Delete post "${p.title}"?`)) return;
    try {
      await api.delete(`/blog/${p.id}`);
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="text-[#D4AF37]" size={26} /> Blog
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Posts shown inside the Flutter app to subscribed users.
          </p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-[#D4AF37] text-black rounded-lg font-semibold">
          <Plus size={18} /> New post
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map((p) => (
          <div key={p.id} className="bg-[#1e293b] rounded-xl border border-[#334155] overflow-hidden">
            {p.imageUrl && (
              <div className="h-36 bg-[#0f172a] overflow-hidden">
                <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-bold flex-1 line-clamp-2">{p.title}</h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${p.isPublished ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                  {p.isPublished ? 'LIVE' : 'DRAFT'}
                </span>
              </div>
              <p className="text-xs text-gray-400 line-clamp-3 mb-3">
                {/* Strip HTML tags for the preview snippet */}
                {p.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}
              </p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{new Date(p.publishedAt).toLocaleDateString()}</span>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(p)} className="text-[#D4AF37]"><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(p)} className="text-red-400"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {posts.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400 bg-[#1e293b] rounded-xl border border-[#334155]">
            No posts yet.
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#1e293b] p-6 rounded-xl border border-[#334155] w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">{editing ? 'Edit' : 'New'} blog post</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
            )}
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Title</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] rounded text-white" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Content</label>
                <RichTextEditor
                  value={form.content}
                  onChange={(html) => setForm({ ...form, content: html })}
                  placeholder="Write your post here…"
                  minHeight={280}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Image URL (optional)</label>
                <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://…" className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] rounded text-white text-sm" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
                Published (visible to subscribers)
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border border-[#334155] rounded-lg text-gray-300">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-[#D4AF37] text-black rounded-lg font-semibold disabled:opacity-50">
                  {saving ? 'Saving…' : editing ? 'Save' : 'Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
