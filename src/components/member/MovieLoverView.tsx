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

  // File Upload Helper for Request Thumbnail
  const handleRequestThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setStatusMessage({ type: 'error', text: 'নিরাপত্তা অ্যালার্ট: কেবল JPG, PNG বা WebP ছবি আপলোড সম্ভব।' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setStatusMessage({ type: 'error', text: 'ছবির ফাইল সাইজ সর্বোচ্চ ৫MB হতে পারবে।' });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setReqThumbnailUrl(reader.result as string);
      setStatusMessage({ type: 'success', text: 'থাম্বনেইল ইমেজ নির্বাচন করা হয়েছে!' });
    };
    reader.readAsDataURL(file);
  };

  const handleOpenRequestModal = () => {
    setReqTitle('');
    setReqYear(new Date().getFullYear().toString());
    setReqThumbnailUrl('');
    setStatusMessage(null);
    setIsRequestModalOpen(true);
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTitle.trim()) {
      setStatusMessage({ type: 'error', text: 'মুভির নাম টাইপ করুন।' });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    const res = await submitMovieRequest({
      movie_title: reqTitle.trim(),
      release_year: reqYear.trim() || '2024',
      thumbnail_url: reqThumbnailUrl.trim() || undefined,
    });

    setIsSubmitting(false);

    if (res.success) {
      setStatusMessage({
        type: 'success',
        text: 'আপনার মুভি রিকোয়েস্ট সফলভাবে জমা হয়েছে! এডমিন প্যানেল থেকে রিভিউ করা হচ্ছে।',
      });
      setTimeout(() => {
        setIsRequestModalOpen(false);
        setActiveTab('my_requests');
      }, 1500);
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'রিকোয়েস্ট সাবমিট করতে সমস্যা হয়েছে।' });
    }
  };

  // Only Published Movies for Members (Layer 3 Security Rule)
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredMovies.map((movie) => (
                <div
                  key={movie.id}
                  onClick={() => setSelectedMovie(movie)}
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
              ))}
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

      {/* Modal 1: Movie Details Modal */}
      {selectedMovie && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-5 my-8 shadow-2xl relative">
            <button
              onClick={() => setSelectedMovie(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col sm:flex-row gap-4">
              <img
                src={selectedMovie.poster_url}
                alt={selectedMovie.title}
                className="w-full sm:w-40 aspect-[2/3] rounded-2xl object-cover shrink-0 border border-slate-800 shadow-xl"
              />

              <div className="space-y-2 flex-1">
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-500/30">
                  {selectedMovie.category} • {selectedMovie.release_year || '2024'}
                </span>

                <h2 className="text-lg font-bold text-white">{selectedMovie.title}</h2>
                <p className="text-xs text-slate-400 leading-relaxed">{selectedMovie.description || 'বিবরণ যুক্ত করা হয়নি।'}</p>

                <div className="text-[11px] text-slate-500 space-y-1 font-mono">
                  <p>ভাষা: <span className="text-slate-300">{selectedMovie.language || 'Bengali'}</span></p>
                  <p>কোয়ালিটি: <span className="text-slate-300">{selectedMovie.quality || '1080p Full HD'}</span></p>
                </div>
              </div>
            </div>

            {/* Video Streams & Links */}
            <div className="border-t border-slate-800 pt-4 space-y-3">
              <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">ডাউনলোড ও ওয়াচ অপশনস</h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                {selectedMovie.resolutions?.res_1080p && (
                  <a
                    href={selectedMovie.resolutions.res_1080p}
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-bold flex items-center justify-between transition"
                  >
                    <span>1080p Full HD</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}

                {selectedMovie.resolutions?.res_720p && (
                  <a
                    href={selectedMovie.resolutions.res_720p}
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 rounded-2xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold flex items-center justify-between transition"
                  >
                    <span>720p HD</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}

                {selectedMovie.pixeldrain_url && (
                  <a
                    href={selectedMovie.pixeldrain_url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold flex items-center justify-between transition"
                  >
                    <span>Pixeldrain Stream</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Request A Movie Modal */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyan-400" />
                <span>Request a Movie</span>
              </h2>
              <button onClick={() => setIsRequestModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {statusMessage && (
              <div
                className={`p-3 rounded-2xl border text-xs font-bold ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                    : 'bg-red-950/80 border-red-800 text-red-300'
                }`}
              >
                {statusMessage.text}
              </div>
            )}

            <form onSubmit={handleSubmitRequest} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">মুভির নাম *</label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: Avengers: Endgame"
                  value={reqTitle}
                  onChange={(e) => setReqTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">মুক্তি পাওয়ার সাল (Release Year)</label>
                <input
                  type="text"
                  placeholder="2019"
                  value={reqYear}
                  onChange={(e) => setReqYear(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="space-y-2 border border-slate-800 rounded-2xl p-3 bg-slate-950/40">
                <label className="block font-bold text-slate-300">থাম্বনেইল / পোস্টার ছবি (Optional)</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={reqThumbnailUrl}
                  onChange={(e) => setReqThumbnailUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-500"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleRequestThumbnailUpload}
                    className="hidden"
                    id="req-thumb-file"
                  />
                  <label
                    htmlFor="req-thumb-file"
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
