# 🎬 Movie Lover System - Full Architecture, UI, SQL & Admin Guide

This folder (`/src/features/movie/`) contains the complete architecture, source code, SQL schema, DRM obfuscation, player modal, member view, and admin management for the **Movie Lover Box** module.

---

## 📂 File Directory Structure
1. **`schema.sql`**: Complete PostgreSQL / Supabase table definitions, Row Level Security (RLS) policies, and seed data.
2. **`MovieBundle.tsx`**: Self-contained TypeScript + React bundle containing all types, crypto cipher engines, player components, and API schemas.
3. **UI Components**:
   - **Member View**: `/src/components/member/MovieLoverView.tsx` (Catalog, search, category filter, 3-layer player launch, custom requests).
   - **DRM Player Modal**: `/src/components/member/MoviePlayerModal.tsx` (In-memory ephemeral stream resolver, dynamic anti-piracy moving watermark with Member Number & Name, custom player controls).
   - **Admin Control**: `/src/components/admin/MovieLoverAdmin.tsx` (Add/Edit movies, publish/draft/archive, multi-resolution streams 480p/720p/1080p, Pixeldrain & GDFlex links, member movie request approval/rejection pipeline).
4. **Security & Cryptography**:
   - `/src/utils/mediaSecurity.ts` (XOR dynamic salt ephemeral tokenization, 3-minute max TTL, prevented URL exposure in DOM).
5. **State Management**:
   - `/src/context/AppContext.tsx` (`movies`, `movieRequests`, `addMovie`, `updateMovie`, `deleteMovie`, `submitMovieRequest`, `updateMovieRequestStatus`).

---

## 🔒 3-Layer DRM & Video Security Architecture
- **Layer 1: Identity Gate**: Only verified `ACTIVE` status community members can request a stream.
- **Layer 2: Ephemeral Cipher**: Raw stream URLs are salted with Member ID and encrypted into a short-lived 3-minute payload (`ObfuscatedMediaStreamPayload`). URLs are never exposed in DOM or HTML source.
- **Layer 3: Moving Anti-Piracy Watermark**: Video player renders an animated, position-randomized floating badge with the viewer's Member ID and Name to deter screen recording and content leakage.
