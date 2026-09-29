import React, { useState } from 'react';
import {
  Film,
  Play,
  Download,
  Search,
  Plus,
  ShieldCheck,
  Eye,
  ExternalLink,
  Sparkles,
  X,
  Tv,
  FileImage,
  Clock,
  CheckCircle2,
  AlertCircle,
  Upload,
  History,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MovieItem, MovieRequest } from '../../types';
import { createEphemeralStreamSession, ObfuscatedMediaStreamPayload } from '../../utils/mediaSecurity';
import { MoviePlayerModal } from './MoviePlayerModal';
import { AdSlot } from '../common/AdSlot';
import { triggerMonetagDirectLink } from '../../utils/monetag';

export const MovieLoverView: React.FC = () => {
  const { currentUser, movies, movieRequests, submitMovieRequest } = useApp();

  const [activeTab, setActiveTab] = useState<'library' | 'my_requests'>('library');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedMovie, setSelectedMovie] = useState<MovieItem | null>(null);

  // Request Movie Modal State
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [reqTitle, setReqTitle] = useState('');
  const [reqYear, setReqYear] = useState('2024');
  const [reqThumbnailUrl, setReqThumbnailUrl] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 3-Layer DRM Obfuscated Stream Session State
  const [activeStreamPayload, setActiveStreamPayload] = useState<{
    movieTitle: string;
    category?: string;
    payload: ObfuscatedMediaStreamPayload;
  } | null>(null);

  const handleLaunchStream = (resolutionLabel: string, rawTargetUrl: string) => {
    // Layer 1: Verify member identity and ACTIVE status
    if (!currentUser || currentUser.status !== 'ACTIVE') {
      alert('নিরাপত্তা অ্যালার্ট: কেবল সক্রিয় (ACTIVE) সদস্যরা মুভি গ্যালারি ব্যবহার করতে পারবেন।');
      return;
    }

    if (!rawTargetUrl) {
      alert('এই রেজুলেশনের জন্য কোনো ভিডিও স্ট্রিম লিংক পাওয়া যায়নি।');
      return;
    }

    // Encrypt raw link with member session salt & generate 3-min ephemeral payload
    const ephemeralPayload = createEphemeralStreamSession(
      selectedMovie?.id || 'm_default',
      resolutionLabel,
      rawTargetUrl,
      currentUser.id
    );

    setActiveStreamPayload({
      movieTitle: selectedMovie?.title || 'Movie Stream',
      category: selectedMovie?.category,
      payload: ephemeralPayload,
    });
  };

  const handleRequestThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      alert('অনুগ্রহ করে JPG, PNG বা WEBP ফরম্যাটের ছবি আপলোড করুন।');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('ছবির সাইজ ৫MB এর কম হতে হবে।');
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      setReqThumbnailUrl(loadEvt.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleOpenRequestModal = () => {
    if (!currentUser) {
      alert('মুভি রিকোয়েস্ট করতে অনুগ্রহ করে লগইন করুন।');
      return;
    }
    setReqTitle('');
    setReqYear(new Date().getFullYear().toString());
    setReqThumbnailUrl('');
    setStatusMessage(null);
    setIsRequestModalOpen(true);
  };

  const handleSubmitMovieRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTitle.trim()) {
      setStatusMessage({ type: 'error', text: 'মুভির নাম লিখুন।' });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    const res = await submitMovieRequest({
      movie_title: reqTitle.trim(),
      release_year: reqYear.trim() || undefined,
      thumbnail_url: reqThumbnailUrl || undefined,
    });

    setIsSubmitting(false);

    if (res.success) {
      setStatusMessage({
        type: 'success',
        text: 'আপনার মুভি রিকোয়েস্ট সফলভাবে জমা হয়েছে! এডমিন শীঘ্রই রিভিউ করে যুক্ত করবেন।',
      });
      setTimeout(() => {
        setIsRequestModalOpen(false);
      }, 2000);
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'রিকোয়েস্ট জমা দেওয়া যায়নি।' });
    }
  };

  const publishedMovies = movies.filter((m) => m.status === 'Published');

  const filteredMovies = publishedMovies.filter((movie) => {
    const matchesSearch =
      movie.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      movie.release_year?.includes(searchQuery);
    const matchesCat = selectedCategory === 'ALL' || movie.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  // Member's own request history
  const myRequests = movieRequests.filter((r) => r.member_id === currentUser?.id);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-slate-900 to-cyan-950 border border-purple-800/40 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 text-purple-400 flex items-center justify-center shrink-0">
            <Tv className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span>Movie Lover Box</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold border border-cyan-500/30">
                Official Release
              </span>
            </h1>
            <p className="text-xs text-slate-400">অনুমোদিত মুভি স্ট্রিমিং ও ব্যক্তিগত মুভি রিকোয়েস্ট সেন্টার</p>
          </div>
        </div>

        <button
          onClick={handleOpenRequestModal}
          className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs shadow-lg shadow-cyan-500/30 flex items-center gap-2 shrink-0 transition"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Request a Movie</span>
        </button>
      </div>

      {/* 🎬 SPONSORED BANNER */}
      <AdSlot />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('library')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'library'
              ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>Movie Library ({publishedMovies.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('my_requests')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'my_requests'
              ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>My Requests ({myRequests.length})</span>
        </button>
      </div>

      {/* Tab 1: Movie Library */}
      {activeTab === 'library' && (
        <div className="space-y-6">
          {/* Search & Category Filter */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="মুভির নাম বা সাল দিয়ে খুঁজুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto scrollbar-none pb-1 sm:pb-0">
              {['ALL', 'Movie', 'Web Series', 'Drama', 'Short Film'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                    selectedCategory === cat
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat === 'ALL' ? 'সবগুলো' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Grid View */}
          {filteredMovies.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-12 text-center space-y-3">
              <Film className="w-12 h-12 mx-auto text-slate-600" />
              <p className="text-slate-400 text-xs">কোনো অনুমোদিত মুভি পাওয়া যায়নি।</p>
              <button
                onClick={handleOpenRequestModal}
                className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs"
              >
                মুভি রিকোয়েস্ট করুন
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredMovies.map((movie, idx) => {
                  const shouldShowAdAfter = (idx + 1) % 8 === 0;

                  return (
                    <React.Fragment key={movie.id}>
                      <div
                        onClick={() => {
                          triggerMonetagDirectLink(undefined, true);
                          setSelectedMovie(movie);
                        }}
                        className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden hover:border-cyan-500/50 transition duration-300 group cursor-pointer flex flex-col justify-between shadow-lg"
                      >
                        <div className="relative aspect-[2/3] overflow-hidden bg-slate-950">
                          <img
                            src={movie.poster_url}
                            alt={movie.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80 group-hover:opacity-60 transition" />

                          <div className="absolute top-2 left-2">
                            <span className="px-2 py-0.5 rounded-full bg-slate-950/80 backdrop-blur-md text-cyan-300 text-[10px] font-bold border border-cyan-500/30">
                              {movie.release_year || '2024'}
                            </span>
                          </div>

                          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                            <span className="px-3 py-1 rounded-xl bg-cyan-500 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow">
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Watch Now</span>
                            </span>
                          </div>
                        </div>

                        <div className="p-3 space-y-1">
                          <h3 className="font-bold text-white text-xs line-clamp-1 group-hover:text-cyan-300 transition">
                            {movie.title}
                          </h3>
                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span>{movie.category}</span>
                            <span className="text-slate-400 font-mono">{movie.quality || '1080p'}</span>
                          </div>
                        </div>
                      </div>

                      {shouldShowAdAfter && (
                        <AdSlot className="col-span-full" />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Bottom of movies section AdSlot */}
              <AdSlot />
            </div>
          )}
        </div>
      )}

      {/* Tab 2: My Request History */}
      {activeTab === 'my_requests' && (
        <div className="space-y-4">
          {myRequests.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-slate-400 text-xs space-y-3">
              <p>আপনি এখনো কোনো মুভি রিকোয়েস্ট করেননি।</p>
              <button
                onClick={handleOpenRequestModal}
                className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs"
              >
                প্রথম মুভি রিকোয়েস্ট দিন
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myRequests.map((req) => (
                <div
                  key={req.id}
                  className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex items-center justify-between gap-4 shadow-lg"
                >
                  <div className="flex items-center gap-3">
                    {req.thumbnail_url ? (
                      <img
                        src={req.thumbnail_url}
                        alt={req.movie_title}
                        className="w-14 h-18 rounded-2xl object-cover shrink-0 border border-slate-800"
                      />
                    ) : (
                      <div className="w-14 h-18 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600 shrink-0">
                        <FileImage className="w-5 h-5" />
                      </div>
                    )}

                    <div className="space-y-1">
                      <h3 className="font-bold text-white text-sm">{req.movie_title}</h3>
                      <p className="text-xs text-purple-400 font-mono">মুক্তি: {req.release_year}</p>
                      <span className="text-[10px] text-slate-500 block">
                        তারিখ: {new Date(req.created_at).toLocaleDateString('bn-BD')}
                      </span>
                    </div>
                  </div>

                  <div className="text-right space-y-1">
                    <span
                      className={`px-3 py-1 rounded-xl text-xs font-bold inline-block ${
                        req.status === 'PENDING'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : req.status === 'ADDED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : req.status === 'APPROVED'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'bg-red-500/20 text-red-300 border border-red-500/30'
                      }`}
                    >
                      {req.status === 'ADDED' ? 'Movie Added' : req.status}
                    </span>

                    {req.admin_notes && (
                      <p className="text-[10px] text-slate-400 max-w-[150px] italic line-clamp-2">
                        নোট: {req.admin_notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Movie Details Modal */}
      {selectedMovie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 relative shadow-2xl">
            <button
              onClick={() => setSelectedMovie(null)}
              className="absolute right-4 top-4 p-2 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex gap-4">
              <img
                src={selectedMovie.poster_url}
                alt={selectedMovie.title}
                className="w-24 h-36 rounded-2xl object-cover border border-slate-800 shrink-0"
              />
              <div className="space-y-1.5">
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">
                  {selectedMovie.category}
                </span>
                <h2 className="text-base font-bold text-white">{selectedMovie.title}</h2>
                <p className="text-xs text-slate-400 font-mono">মুক্তি: {selectedMovie.release_year}</p>
                <p className="text-xs text-slate-400">কোয়ালিটি: <span className="text-white font-mono">{selectedMovie.quality || '1080p'}</span></p>
              </div>
            </div>

            {selectedMovie.description && (
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
                {selectedMovie.description}
              </p>
            )}

            {/* Quality Stream Launcher Buttons (Protected DRM Sandbox) */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>ভিডিও কোয়ালিটি ও সার্ভার নির্বাচন</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectedMovie.stream_1080p_url && (
                  <button
                    onClick={() => handleLaunchStream('1080p HD Server', selectedMovie.stream_1080p_url!)}
                    className="p-3 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-bold text-xs flex items-center justify-between transition group"
                  >
                    <div className="flex items-center gap-2">
                      <Play className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition" />
                      <span>1080p Full HD</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">High Speed</span>
                  </button>
                )}

                {selectedMovie.stream_720p_url && (
                  <button
                    onClick={() => handleLaunchStream('720p Fast Server', selectedMovie.stream_720p_url!)}
                    className="p-3 rounded-2xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold text-xs flex items-center justify-between transition group"
                  >
                    <div className="flex items-center gap-2">
                      <Play className="w-4 h-4 text-purple-400 group-hover:scale-110 transition" />
                      <span>720p Standard</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">Fast Load</span>
                  </button>
                )}

                {selectedMovie.stream_480p_url && (
                  <button
                    onClick={() => handleLaunchStream('480p Low Data', selectedMovie.stream_480p_url!)}
                    className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-between transition group"
                  >
                    <div className="flex items-center gap-2">
                      <Play className="w-4 h-4 text-slate-400 group-hover:scale-110 transition" />
                      <span>480p Data Saver</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">Low Data</span>
                  </button>
                )}

                {selectedMovie.direct_download_url && (
                  <button
                    onClick={() => handleLaunchStream('Pixeldrain Ultra Stream', selectedMovie.direct_download_url!)}
                    className="p-3 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center justify-between transition group sm:col-span-2"
                  >
                    <div className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition" />
                      <span>Pixeldrain Direct Fast Server</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-mono">100% Buffered</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Secure Ephemeral Player */}
      {activeStreamPayload && (
        <MoviePlayerModal
          movieTitle={activeStreamPayload.movieTitle}
          category={activeStreamPayload.category}
          payload={activeStreamPayload.payload}
          onClose={() => setActiveStreamPayload(null)}
        />
      )}

      {/* Request Movie Modal */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setIsRequestModalOpen(false)}
              className="absolute right-4 top-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                <span>নতুন মুভি রিকোয়েস্ট করুন</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">আপনার পছন্দের মুভি লিংক এডমিনের কাছে পাঠাতে পারেন।</p>
            </div>

            {statusMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                    : 'bg-red-950/60 border border-red-800 text-red-300'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleSubmitMovieRequest} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">মুভির সঠিক নাম *</label>
                <input
                  type="text"
                  placeholder="যেমন: Inception, Jawan, তুফান"
                  value={reqTitle}
                  onChange={(e) => setReqTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">মুক্তির সাল (Release Year)</label>
                <input
                  type="text"
                  placeholder="2024"
                  value={reqYear}
                  onChange={(e) => setReqYear(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">পোস্টার / থাম্বনেইল ছবি (ঐচ্ছিক)</label>
                <div className="flex items-center gap-3">
                  {reqThumbnailUrl ? (
                    <img
                      src={reqThumbnailUrl}
                      alt="Thumbnail Preview"
                      className="w-12 h-16 rounded-xl object-cover border border-slate-800"
                    />
                  ) : (
                    <div className="w-12 h-16 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600">
                      <Upload className="w-4 h-4" />
                    </div>
                  )}

                  <input
                    type="file"
                    id="req-poster-upload"
                    accept="image/*"
                    onChange={handleRequestThumbnailUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="req-poster-upload"
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer font-bold text-[11px] flex items-center gap-1.5 transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>ছবি সিলেক্ট করুন (JPG/PNG Max 5MB)</span>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black shadow-lg shadow-cyan-500/30 flex items-center gap-2"
                >
                  {isSubmitting ? 'প্রসেসিং...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
