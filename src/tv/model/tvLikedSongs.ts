// src/tv/model/tvLikedSongs.ts

import type { MediaId } from '../../types/onlineMusic';
import type { SongResult } from '../../types';
import { getPlaybackSongKey } from '../../utils/appPlaybackGuards';

export const resolveTvLikedOwnerKey = (
    providerId: string,
    userId: MediaId | null,
    collectionId: string | null,
): string | null => (
    userId === null
        ? null
        : `${providerId}:${String(userId)}:${collectionId ?? 'provider'}`
);

export const isTvLikedSnapshotCurrent = (
    loadedOwnerKey: string | null,
    currentOwnerKey: string | null,
): boolean => loadedOwnerKey !== null && loadedOwnerKey === currentOwnerKey;

export type TvLikedSongChange = {
    song: SongResult;
    liked: boolean;
};

export const applyTvLikedSongChange = (
    songs: SongResult[],
    change: TvLikedSongChange,
): SongResult[] => {
    const songKey = getPlaybackSongKey(change.song);
    const index = songs.findIndex(candidate => getPlaybackSongKey(candidate) === songKey);

    if (change.liked) {
        return index < 0 ? [change.song, ...songs] : songs;
    }

    return index < 0
        ? songs
        : [...songs.slice(0, index), ...songs.slice(index + 1)];
};

export const mergeTvLikedSongChanges = (
    songs: SongResult[],
    changes: Iterable<TvLikedSongChange>,
): SongResult[] => {
    let next = songs;
    for (const change of changes) {
        next = applyTvLikedSongChange(next, change);
    }
    return next;
};
