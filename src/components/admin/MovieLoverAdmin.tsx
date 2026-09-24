import React, { useState } from 'react';
import {
  Film,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Trash2,
  Edit,
  Sparkles,
  AlertTriangle,
  Upload,
  FileImage,
  MessageSquare,
  Filter,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MovieItem, MovieRequest, MovieRequestStatus, MovieStatus } from '../../types';

export const MovieLoverAdmin: React.FC = () => {
  const {
    currentUser,
    movies,
    movieRequests,
    addMovie,
    updateMovie,
    deleteMovie,
    updateMovieRequestStatus,
  } = useApp();

  const isDevOrAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'DEVELOPER';

  const [activeTab, setActiveTab] = useState<'library' | 'requests'>('library');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Add/Edit Movie Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMovie, setEditingMovie] = useState<MovieItem | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [releaseYear, setReleaseYear] = useState('2024');
  const [category, setCategory] = useState<'Movie' | 'Web Series' | 'Drama' | 'Short Film'>('Movie');
  const [posterUrl, setPosterUrl] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('Bengali');
  const [quality, setQuality] = useState('1080p');
  const [status, setStatus] = useState<MovieStatus>('Published');
  const [res480p, setRes480p] = useState('');
  const [res720p, setRes720p] = useState('');
  const [res1080p, setRes1080p] = useState('');
  const [pixeldrainUrl, setPixeldrainUrl] = useState('');
  const [gdflexUrl, setGdflexUrl] = useState('');

  // Request Action Modal State
  const [selectedRequest, setSelectedRequest] = useState<MovieRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // File Upload Helper with MIME & File Size Security Validation
  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // MIME Validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setMessage({ type: 'error', text: 'নিরাপত্তা অ্যালার্ট: কেবল JPG, PNG বা WebP ইমেজ আপলোড অনুমোদিত।' });
      return;
    }

    // Size Validation (Max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'ইমেজ সাইজ সর্বোচ্চ ৫MB হতে পারবে।' });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPosterUrl(reader.result as string);
      setMessage({ type: 'success', text: 'থাম্বনেইল ইমেজ সফলভাবে নির্বাচন করা হয়েছে!' });
    };
    reader.readAsDataURL(file);
  };

  const handleOpenAddModal = () => {
    setEditingMovie(null);
    setTitle('');
    setReleaseYear(new Date().getFullYear().toString());
    setCategory('Movie');
    setPosterUrl('');
    setDescription('');
    setLanguage('Bengali');
    setQuality('1080p');
    setStatus('Published');
    setRes480p('');
    setRes720p('');
    setRes1080p('');
    setPixeldrainUrl('');
    setGdflexUrl('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (movie: MovieItem) => {
    setEditingMovie(movie);
    setTitle(movie.title);
    setReleaseYear(movie.release_year || '2024');
    setCategory(movie.category);
    setPosterUrl(movie.poster_url);
    setDescription(movie.description || '');
    setLanguage(movie.language || 'Bengali');
    setQuality(movie.quality || '1080p');
    setStatus(movie.status || 'Published');
    setRes480p(movie.resolutions?.res_480p || '');
    setRes720p(movie.resolutions?.res_720p || '');
    setRes1080p(movie.resolutions?.res_1080p || '');
    setPixeldrainUrl(movie.pixeldrain_url || '');
    setGdflexUrl(movie.gdflex_url || '');
    setIsModalOpen(true);
  };

  const handleSaveMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setMessage({ type: 'error', text: 'মুভির শিরোনাম দেওয়া বাধ্যতামূলক।' });
      return;
    }

    const movieData: Omit<MovieItem, 'id' | 'created_at'> = {
      title: title.trim(),
      release_year: releaseYear.trim() || '2024',
      category,
      poster_url: posterUrl.trim() || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=80',
      description: description.trim(),
      language,
      quality,
      status,
      resolutions: {
        res_480p: res480p.trim() || undefined,
        res_720p: res720p.trim() || undefined,
        res_1080p: res1080p.trim() || undefined,
      },
      pixeldrain_url: pixeldrainUrl.trim() || undefined,
      gdflex_url: gdflexUrl.trim() || undefined,
    };

    if (editingMovie) {
      const res = await updateMovie(editingMovie.id, movieData);
      if (res.success) {
        setMessage({ type: 'success', text: 'মুভি সফলভাবে আপডেট করা হয়েছে!' });
        setIsModalOpen(false);
      } else {
        setMessage({ type: 'error', text: res.error || 'আপডেট করতে ব্যর্থ হয়েছে।' });
      }
    } else {
      const res = await addMovie(movieData);
      if (res.success) {
        setMessage({ type: 'success', text: 'নতুন মুভি সফলভাবে আপলোড করা হয়েছে!' });
        setIsModalOpen(false);
      } else {
        setMessage({ type: 'error', text: res.error || 'আপলোড করতে ব্যর্থ হয়েছে।' });
      }
    }
  };

  const handleDeleteMovie = async (movie: MovieItem) => {
    if (confirm(`আপনি কি "${movie.title}" মুভিটি আর্কাইভ/ডিলিট করতে চান?`)) {
      const res = await deleteMovie(movie.id);
      if (res.success) {
        setMessage({ type: 'success', text: 'মুভিটি সরানো হয়েছে।' });
      } else {
        setMessage({ type: 'error', text: res.error || 'ডিলিট ব্যর্থ।' });
      }
    }
  };

  const handleUpdateReqStatus = async (
    reqId: string,
    newStatus: MovieRequestStatus,
    reason?: string
  ) => {
    const res = await updateMovieRequestStatus(reqId, newStatus, reason);
    if (res.success) {
      setMessage({ type: 'success', text: `রিকোয়েস্ট স্ট্যাটাস ${newStatus} এ আপডেট করা হয়েছে।` });
      setSelectedRequest(null);
      setRejectReason('');
    } else {
      setMessage({ type: 'error', text: res.error || 'স্ট্যাটাস আপডেট ব্যর্থ।' });
    }
  };

  const filteredMovies = movies.filter((m) => {
    const matchesSearch =
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.release_year?.includes(searchQuery);
    const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredRequests = movieRequests.filter((r) => {
    const matchesSearch =
      r.movie_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.member_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.member_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (!isDevOrAdmin) {
    return (
      <div className="bg-red-950/30 border border-red-800 rounded-3xl p-6 text-center text-red-400 font-bold space-y-2">
        <ShieldAlert className="w-10 h-10 mx-auto text-red-500" />
        <p>সিকিউরিটি অ্যালার্ট: আপনার একাউন্টে এডমিন পারমিশন নেই।</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-950/80 via-slate-900 to-slate-950 border border-purple-800/40 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 text-purple-400 flex items-center justify-center shrink-0">
            <Film className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span>Movie Lover Admin Center</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-300 font-mono font-bold">
                3-Layer Secured
              </span>
            </h1>
            <p className="text-xs text-slate-400">মুভি লাইব্রেরি আপলোড, ক্যাটাগরি ও মেম্বার রিকোয়েস্ট ম্যানেজমেন্ট</p>
          </div>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 flex items-center gap-2 shrink-0 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Upload Movie</span>
        </button>
      </div>

      {/* Alert Messages */}
      {message && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
              : 'bg-red-950/80 border-red-800 text-red-300'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs Bar */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
        <button
          onClick={() => {
            setActiveTab('library');
            setStatusFilter('ALL');
          }}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'library'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>Movie Library ({movies.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('requests');
            setStatusFilter('ALL');
          }}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 relative ${
            activeTab === 'requests'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Movie Requests ({movieRequests.length})</span>
          {movieRequests.filter((r) => r.status === 'PENDING').length > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          )}
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="খুঁজুন (টাইটেল, সাল, সদস্য)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500 font-mono"
          >
            <option value="ALL">সব স্ট্যাটাস (ALL)</option>
            {activeTab === 'library' ? (
              <>
                <option value="Published">Published</option>
                <option value="Draft">Draft</option>
                <option value="Hidden">Hidden</option>
                <option value="Archived">Archived</option>
              </>
            ) : (
              <>
                <option value="PENDING">Pending</option>
                <option value="REVIEWING">Reviewing</option>
                <option value="APPROVED">Approved</option>
                <option value="ADDED">Added</option>
                <option value="REJECTED">Rejected</option>
                <option value="ALREADY_AVAILABLE">Already Available</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* Tab 1: Movie Library */}
      {activeTab === 'library' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredMovies.map((movie) => (
            <div
              key={movie.id}
              className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden hover:border-purple-500/50 transition group flex flex-col justify-between"
            >
              <div>
                <div className="relative aspect-[16/9] overflow-hidden bg-slate-950">
                  <img
                    src={movie.poster_url}
                    alt={movie.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute top-2 left-2 flex gap-1">
                    <span className="px-2 py-0.5 rounded-full bg-slate-950/80 backdrop-blur-md text-cyan-300 text-[10px] font-bold border border-cyan-500/30">
                      {movie.category}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-purple-950/80 backdrop-blur-md text-purple-300 text-[10px] font-bold border border-purple-500/30">
                      {movie.release_year}
                    </span>
                  </div>

                  <span
                    className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      movie.status === 'Published'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : movie.status === 'Draft'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {movie.status}
                  </span>
                </div>

                <div className="p-4 space-y-2">
                  <h3 className="font-bold text-white text-sm line-clamp-1">{movie.title}</h3>
                  <p className="text-slate-400 text-xs line-clamp-2">{movie.description || 'no description'}</p>

                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span>{movie.language || 'Bengali'}</span> • <span>{movie.quality || '1080p'}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 pt-0 border-t border-slate-800/60 mt-2 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleOpenEditModal(movie)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 flex-1 justify-center"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>

                <button
                  onClick={() => handleDeleteMovie(movie)}
                  className="p-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-400 transition"
                  title="Archive / Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Movie Requests Panel */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {filteredRequests.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-slate-400 text-xs">
              কোনো রিকোয়েস্ট পাওয়া যায়নি।
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRequests.map((req) => (
                <div
                  key={req.id}
                  className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3 flex flex-col justify-between hover:border-purple-500/40 transition"
                >
                  <div className="flex gap-3">
                    {req.thumbnail_url ? (
                      <img
                        src={req.thumbnail_url}
                        alt={req.movie_title}
                        className="w-16 h-20 rounded-xl object-cover shrink-0 border border-slate-800"
                      />
                    ) : (
                      <div className="w-16 h-20 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 text-slate-600">
                        <FileImage className="w-6 h-6" />
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-sm">{req.movie_title}</h3>
                        <span className="text-xs text-purple-400 font-mono">({req.release_year})</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        অনুরোধকারী: <span className="text-cyan-300 font-semibold">{req.member_name}</span> ({req.member_number})
                      </p>
                      <span className="text-[10px] text-slate-500 block font-mono">
                        তারিখ: {new Date(req.created_at).toLocaleDateString('bn-BD')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-800/60 pt-3 gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold ${
                        req.status === 'PENDING'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : req.status === 'ADDED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : req.status === 'APPROVED'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'bg-red-500/20 text-red-300 border border-red-500/30'
                      }`}
                    >
                      {req.status}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {req.status === 'PENDING' && (
                        <button
                          onClick={() => handleUpdateReqStatus(req.id, 'APPROVED')}
                          className="px-2.5 py-1 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold transition"
                        >
                          Approve
                        </button>
                      )}

                      {req.status !== 'ADDED' && (
                        <button
                          onClick={() => handleUpdateReqStatus(req.id, 'ADDED')}
                          className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition"
                        >
                          Mark Added
                        </button>
                      )}

                      <button
                        onClick={() => setSelectedRequest(req)}
                        className="px-2.5 py-1 rounded-xl bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 text-[11px] font-bold transition"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal 1: Add / Edit Movie Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-4 my-8 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Film className="w-5 h-5 text-purple-400" />
                <span>{editingMovie ? 'মুভি সম্পাদনা করুন' : 'নতুন মুভি আপলোড করুন'}</span>
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMovie} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">মুভির নাম *</label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: Interstellar"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">মুক্তি পাওয়ার সাল (Release Year)</label>
                  <input
                    type="text"
                    placeholder="2024"
                    value={releaseYear}
                    onChange={(e) => setReleaseYear(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">ক্যাটাগরি</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-500"
                  >
                    <option value="Movie">Movie</option>
                    <option value="Web Series">Web Series</option>
                    <option value="Drama">Drama</option>
                    <option value="Short Film">Short Film</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">ভাষা</label>
                  <input
                    type="text"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">স্ট্যাটাস (Visibility)</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as MovieStatus)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-500 font-mono"
                  >
                    <option value="Published">Published (লাইভ)</option>
                    <option value="Draft">Draft (এডমিন কেবল)</option>
                    <option value="Hidden">Hidden (হাইড)</option>
                    <option value="Archived">Archived (আর্কাইভ)</option>
                  </select>
                </div>
              </div>

              {/* Thumbnail Section */}
              <div className="space-y-2 border border-slate-800 rounded-2xl p-3 bg-slate-950/40">
                <label className="block font-bold text-slate-300">থাম্বনেইল (URL অথবা ফাইল আপলোড)</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={posterUrl}
                  onChange={(e) => setPosterUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-500"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleThumbnailUpload}
                    className="hidden"
                    id="thumb-file"
                  />
                  <label
                    htmlFor="thumb-file"
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer font-bold text-[11px] flex items-center gap-1.5 transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>ফাইল চুজ করুন (Max 5MB)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">বিবরণ (Description)</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-500 resize-none"
                />
              </div>

              {/* Resolution Links */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-300">ভিডিও ও ডাউনলোড লিঙ্কসমূহ (480p / 720p / 1080p)</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="url"
                    placeholder="480p URL"
                    value={res480p}
                    onChange={(e) => setRes480p(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white outline-none focus:border-purple-500 font-mono"
                  />
                  <input
                    type="url"
                    placeholder="720p URL"
                    value={res720p}
                    onChange={(e) => setRes720p(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white outline-none focus:border-purple-500 font-mono"
                  />
                  <input
                    type="url"
                    placeholder="1080p URL"
                    value={res1080p}
                    onChange={(e) => setRes1080p(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white outline-none focus:border-purple-500 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition shadow-lg shadow-purple-600/30"
                >
                  {editingMovie ? 'আপডেট সেভ করুন' : 'পাবলিশ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Reject Request Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-white text-base">রিকোয়েস্ট রিজেক্ট করুন</h3>
            <p className="text-xs text-slate-400">
              "{selectedRequest.movie_title}" রিকোয়েস্টটি কেন রিজেক্ট করা হচ্ছে তা উল্লেখ করুন।
            </p>

            <textarea
              rows={3}
              placeholder="যেমন: Movie source unavailable or already in pipeline."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-red-500 resize-none"
            />

            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
              >
                বাতিল
              </button>
              <button
                onClick={() => handleUpdateReqStatus(selectedRequest.id, 'REJECTED', rejectReason)}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold shadow-lg shadow-red-600/30"
              >
                Reject Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
