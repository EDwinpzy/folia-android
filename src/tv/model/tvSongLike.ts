import { resolveCanonicalLocalSongId } from '../../services/localPlaylistService';
import type { LocalSong } from '../../types';

// src/tv/model/tvSongLike.ts
// Resolves a playing local song to the record and canonical id its favorite playlist stores.

export type TvLocalSongFavorite = {
    localSong: LocalSong | null;
    isLiked: boolean;
};

export const resolveTvLocalSongFavorite = (
    songId: string,
    songs: LocalSong[],
    favoriteSongIds: readonly string[],
): TvLocalSongFavorite => {
    const localSong = songs.find(song => song.id === songId) ?? null;
    if (!localSong) return { localSong: null, isLiked: false };

    const canonicalSongId = resolveCanonicalLocalSongId(songId, songs);
    return {
        localSong,
        isLiked: favoriteSongIds.includes(canonicalSongId),
    };
};
