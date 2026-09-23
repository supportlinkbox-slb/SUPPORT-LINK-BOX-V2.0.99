import React, { useState, useEffect } from 'react';
import { Film, Play, Download, Search, Plus, Trash2, Shield, Eye, ExternalLink, Sparkles, X, Tv } from 'lucide-react';
import { MovieItem } from '../../types';
import { useApp } from '../../context/AppContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

// Seed Movies for initial view
const INITIAL_MOVIES: MovieItem[] = [
  {
    id: 'movie-1',
    title: 'Pather Panchali (পথের পাঁচালী)',
    category: 'Movie',
    poster_url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=80',
    description: 'Satyajit Ray classic masterpiece drama celebrating Bengali life and cinema history.',
    resolutions: {
      res_480p: 'https://pixeldrain.com/u/sample480',
      res_720p: 'https://pixeldrain.com/u/sample720',
      res_1080p: 'https://pixeldrain.com/u/sample1080',
    },
    pixeldrain_url: 'https://pixeldrain.com/u/sample1080',
    gdflex_url: 'https://gdflex.net/view/sample1080',
    created_at: new Date().toISOString(),
  },
  {
    id: 'movie-2',
    title: 'Hawa (হাওয়া)',
    category: 'Movie',
    poster_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80',
    description: 'A mystery drama thriller in deep sea waters directed by Mejbaur Rahman Sumon.',
    resolutions: {
      res_720p: 'https://pixeldrain.com/u/hawa720',
      res_1080p: 'https://pixeldrain.com/u/hawa1080',
    },
    pixeldrain_url: 'https://pixeldrain.com/u/hawa1080',
    gdflex_url: 'https://gdflex.net/view/hawa1080',
    created_at: new Date().toISOString(),
  },
];

export const MovieLoverView: React.FC = () => {
  const { currentUser } = useApp();
  const isAdminOrDev = currentUser?.role === 'ADMIN' || currentUser?.role === 'DEVELOPER';

  const [movies, setMovies] = useState<MovieItem[]>(INITIAL_MOVIES);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedMovie, setSelectedMovie] = useState<MovieItem | null>(null);
  const [selectedRes, setSelectedRes] = useState<'480p' | '720p' | '1080p'>('720p');

  // Add Movie Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'Movie' | 'Web Series' | 'Drama' | 'Short Film'>('Movie');
  const [newPosterUrl, setNewPosterUrl] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [res480p, setRes480p] = useState('');
  const [res720p, setRes720p] = useState('');
  const [res1080p, setRes1080p] = useState('');
  const [pixeldrainUrl, setPixeldrainUrl] = useState('');
  const [gdflexUrl, setGdflexUrl] = useState('');

  useEffect(() => {
    fetchMovies();
  }, []);

  const fetchMovies = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from('media_items')
        .select('*')
        .eq('category', 'ENTERTAINMENT')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped: MovieItem[] = data.map((m: any) => ({
          id: m.id,
          title: m.title,
          category: (m.metadata?.category as any) || 'Movie',
          poster_url: m.thumbnail_path || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=80',
          description: m.description,
          resolutions: m.metadata?.resolutions || {},
          pixeldrain_url: m.metadata?.pixeldrain_url,
          gdflex_url: m.external_url,
          created_at: m.created_at,
        }));
        setMovies([...mapped, ...INITIAL_MOVIES]);
      }
    } catch (err) {
      console.error('Error fetching movies:', err);
    }
  };

  const handleAddMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newMovieItem: MovieItem = {
      id: `movie-${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      poster_url: newPosterUrl.trim() || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=80',
      description: newDescription.trim(),
      resolutions: {
        res_480p: res480p.trim() || undefined,
        res_720p: res720p.trim() || undefined,
        res_1080p: res1080p.trim() || undefined,
      },
      pixeldrain_url: pixeldrainUrl.trim() || undefined,
      gdflex_url: gdflexUrl.trim() || undefined,
      created_at: new Date().toISOString(),
    };

    setMovies([newMovieItem, ...movies]);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('media_items').insert({
          title: newMovieItem.title,
          description: newMovieItem.description,
          media_type: 'MOVIE',
          category: 'ENTERTAINMENT',
          external_url: newMovieItem.gdflex_url,
          thumbnail_path: newMovieItem.poster_url,
          status: 'PUBLISHED',
          visibility: 'COMMUNITY',
          metadata: {
            category: newMovieItem.category,
            resolutions: newMovieItem.resolutions,
            pixeldrain_url: newMovieItem.pixeldrain_url,
          },
        });
      } catch (err) {
        console.error('Error persisting movie:', err);
      }
    }

    // Reset Form
    setNewTitle('');
    setNewPosterUrl('');
    setNewDescription('');
    setRes480p('');
    setRes720p('');
    setRes1080p('');
    setPixeldrainUrl('');
    setGdflexUrl('');
    setIsAddOpen(false);
  };

  const handleDeleteMovie = async (id: string) => {
    if (!confirm('আপনি কি এই মুভিটি মুছে ফেলতে চান?')) return;
    setMovies(movies.filter((m) => m.id !== id));
    if (selectedMovie?.id === id) setSelectedMovie(null);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('media_items').delete().eq('id', id);
      } catch (err) {
        console.error('Error deleting movie:', err);
      }
    }
  };

  const filteredMovies = movies.filter((m) => {
    const matchesSearch =
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'ALL' || m.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-900/40 via-slate-900 to-indigo-950/60 border border-purple-800/40 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 rounded-full bg-purple-500/10 blur-3xl pointer-events-none"></div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold">
              <Film className="w-3.5 h-3.5" />
              <span>Movie Lover & Entertainment Zone</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              বিনোদন ও মুভি কালেকশন (Movie Lover Zone)
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
              সেরা বাংলা ও আন্তর্জাতিক মুভি, ওয়েব সিরিজ এবং নাটকের হাই-কোয়ালিটি (480p, 720p, 1080p) ডাউনলোড ও দেখার নির্ভরযোগ্য প্ল্যাটফর্ম।
            </p>
          </div>

          {isAdminOrDev && (
            <button
              onClick={() => setIsAddOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-purple-600/30 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>নতুন মুভি আপলোড</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="মুভির নাম লিখে খুঁজুন..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {['ALL', 'Movie', 'Web Series', 'Drama', 'Short Film'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                selectedCategory === cat
                  ? 'bg-purple-600 text-white shadow'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {cat === 'ALL' ? 'সকল বিনোদন' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Movies Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filteredMovies.map((movie) => (
          <div
            key={movie.id}
            className="group relative bg-slate-900/90 border border-slate-800 hover:border-purple-500/50 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-purple-950/40 flex flex-col"
          >
            {/* Poster Image */}
            <div className="aspect-[2/3] w-full overflow-hidden relative bg-slate-950">
              <img
                src={movie.poster_url}
                alt={movie.title}
                className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                onError={(e) => {
                  (e.target as any).src =
                    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=80';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80"></div>

              {/* Category Badge */}
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-purple-900/80 backdrop-blur-md text-[10px] font-bold text-purple-200 border border-purple-700/50">
                {movie.category}
              </span>

              {/* Admin Delete Button */}
              {isAdminOrDev && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteMovie(movie.id);
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-950/80 text-red-400 hover:bg-red-600 hover:text-white transition"
                  title="মুছে ফেলুন"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Play Overlay Button */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300 bg-slate-950/60 backdrop-blur-xs">
                <button
                  onClick={() => setSelectedMovie(movie)}
                  className="w-12 h-12 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-600/40 hover:scale-110 transition"
                >
                  <Play className="w-6 h-6 fill-white ml-0.5" />
                </button>
              </div>
            </div>

            {/* Info */}
            <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
              <div>
                <h3 className="text-xs font-bold text-white line-clamp-1 group-hover:text-purple-300 transition">
                  {movie.title}
                </h3>
                <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                  {movie.description || 'কোনো বিবরণ নেই'}
                </p>
              </div>

              <button
                onClick={() => setSelectedMovie(movie)}
                className="w-full py-1.5 rounded-xl bg-slate-950 hover:bg-purple-950/50 border border-slate-800 hover:border-purple-800/60 text-purple-300 text-[11px] font-bold transition flex items-center justify-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>দেখুন / ডাউনলোড</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Movie Details Modal */}
      {selectedMovie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedMovie(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col sm:flex-row gap-6">
              <img
                src={selectedMovie.poster_url}
                alt={selectedMovie.title}
                className="w-full sm:w-48 aspect-[2/3] object-cover rounded-2xl border border-slate-800"
              />

              <div className="space-y-4 flex-1">
                <div>
                  <span className="px-2.5 py-1 rounded-md bg-purple-900/60 border border-purple-700/50 text-purple-300 text-xs font-bold">
                    {selectedMovie.category}
                  </span>
                  <h2 className="text-xl font-bold text-white mt-2">{selectedMovie.title}</h2>
                  <p className="text-xs text-slate-300 mt-2">{selectedMovie.description}</p>
                </div>

                {/* Quality Options */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-400">কোয়ালিটি নির্বাচন করুন:</span>
                  <div className="flex gap-2">
                    {['480p', '720p', '1080p'].map((res) => {
                      const key = `res_${res}` as keyof typeof selectedMovie.resolutions;
                      const hasRes = !!selectedMovie.resolutions[key];
                      return (
                        <button
                          key={res}
                          disabled={!hasRes}
                          onClick={() => setSelectedRes(res as any)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                            selectedRes === res && hasRes
                              ? 'bg-purple-600 border-purple-500 text-white'
                              : hasRes
                              ? 'bg-slate-950 border-slate-800 text-slate-300 hover:border-purple-800'
                              : 'bg-slate-950/40 border-slate-900 text-slate-600 cursor-not-allowed line-through'
                          }`}
                        >
                          {res}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Download / Play Buttons */}
                <div className="pt-2 space-y-2">
                  {selectedMovie.pixeldrain_url && (
                    <a
                      href={selectedMovie.pixeldrain_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30"
                    >
                      <Download className="w-4 h-4" />
                      <span>Pixeldrain হাইস্পিড ডাউনলোড ({selectedRes})</span>
                      <ExternalLink className="w-3.5 h-3.5 ml-auto opacity-70" />
                    </a>
                  )}

                  {selectedMovie.gdflex_url && (
                    <a
                      href={selectedMovie.gdflex_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-indigo-300 font-bold text-xs transition flex items-center justify-center gap-2"
                    >
                      <Tv className="w-4 h-4 text-indigo-400" />
                      <span>GDFlex অনলাইন প্লেয়ার এ প্লে করুন</span>
                      <ExternalLink className="w-3.5 h-3.5 ml-auto opacity-70" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Movie Modal for Admin */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Film className="w-5 h-5 text-purple-400" />
                <span>নতুন মুভি / কন্টেন্ট যোগ করুন</span>
              </h2>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMovie} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">মুভি / ড্রামার শিরোনাম *</label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: হাওয়া (Hawa)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-purple-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">ক্যাটাগরি</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-purple-500 outline-none"
                  >
                    <option value="Movie">Movie</option>
                    <option value="Web Series">Web Series</option>
                    <option value="Drama">Drama</option>
                    <option value="Short Film">Short Film</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">পোস্টার ইমেজ URL</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={newPosterUrl}
                    onChange={(e) => setNewPosterUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-purple-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">সংক্ষিপ্ত বিবরণ</label>
                <textarea
                  rows={2}
                  placeholder="মুভি সম্পর্কে সংক্ষেপে লিখুন..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-purple-500 outline-none resize-none"
                />
              </div>

              {/* Resolution Links */}
              <div className="space-y-2 border-t border-slate-800/80 pt-3">
                <span className="font-bold text-purple-300 block">ডাউনলোড লিংকস (Pixeldrain / GDFlex):</span>
                <input
                  type="url"
                  placeholder="480p Link"
                  value={res480p}
                  onChange={(e) => setRes480p(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white outline-none"
                />
                <input
                  type="url"
                  placeholder="720p Link"
                  value={res720p}
                  onChange={(e) => setRes720p(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white outline-none"
                />
                <input
                  type="url"
                  placeholder="1080p Link"
                  value={res1080p}
                  onChange={(e) => setRes1080p(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white outline-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-500 shadow-lg shadow-purple-600/30"
                >
                  পাবলিশ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
