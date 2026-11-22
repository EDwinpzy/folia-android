import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getLocalSongs } from '../../services/db';
import {
    getLocalPlaylists,
    setLocalSongFavorite,
} from '../../services/localPlaylistService';
import { omni } from '../../services/onlineMusic/omni';
import { useOnlineProviderAccountStore } from '../../stores/useOnlineProviderAccountStore';
import type { LocalSong, SongResult } from '../../types';
import { getPlaybackSongKey, getPlaybackSourceRef } from '../../utils/appPlaybackGuards';
import { resolveTvLocalSongFavorite } from '../model/tvSongLike';

// src/tv/hooks/useTvSongLike.ts
// The playing song's one favorite action on TV, over the local favorite playlist and online providers.

const NOTICE_MS = 2800;

type LocalFavoriteState = {
    songId: string;
    loading: boolean;
    localSong: LocalSong | null;
    isLiked: boolean;
};

export type TvSongLikeNotice = {
    tone: 'success' | 'error';
    text: string;
};

export type TvSongLikeModel = {
    isLiked: boolean;
    disabled: boolean;
    disabledReason?: string;
    pending: boolean;
    notice: TvSongLikeNotice | null;
    toggle: () => void;
};

export const useTvSongLike = (
    song: SongResult | null,
    onLikeChanged?: (song: SongResult, liked: boolean) => void,
): TvSongLikeModel => {
    const { t } = useTranslation();
    const sourceRef = song ? getPlaybackSourceRef(song) : null;
    const sourceKind = sourceRef?.kind ?? null;
    const providerId = sourceRef?.kind === 'online' ? sourceRef.providerId : null;
    const localSongId = sourceRef?.kind === 'local' ? sourceRef.mediaId : null;
    const songKey = song ? getPlaybackSongKey(song) : null;
    const songKeyRef = useRef(songKey);
    const localWriteRef = useRef<string | null>(null);
    const account = useOnlineProviderAccountStore(state => (
        providerId ? state.accounts[providerId] : undefined
    ));
    const accountId = account?.user?.id ?? null;
    const accountIdRef = useRef(accountId);
    accountIdRef.current = accountId;
    const [localFavorite, setLocalFavorite] = useState<LocalFavoriteState | null>(null);
    const [pendingSongId, setPendingSongId] = useState<string | null>(null);
    const [notice, setNotice] = useState<(TvSongLikeNotice & { songKey: string; }) | null>(null);
    songKeyRef.current = songKey;

    useEffect(() => {
        if (!localSongId) {
            setLocalFavorite(null);
            return undefined;
        }

        let cancelled = false;
        const isCancelled = () => cancelled;
        setLocalFavorite({
            songId: localSongId,
            loading: true,
            localSong: null,
            isLiked: false,
        });
        void (async () => {
            try {
                const songs = await getLocalSongs();
                const playlists = await getLocalPlaylists();
                if (isCancelled()) return;
                const favoritePlaylist = playlists.find(playlist => playlist.isFavorite);
                const favorite = resolveTvLocalSongFavorite(
                    localSongId,
                    songs,
                    favoritePlaylist?.songIds ?? [],
                );
                setLocalFavorite({
                    songId: localSongId,
                    loading: false,
                    ...favorite,
                });
            } catch (error) {
                if (isCancelled()) return;
                console.warn('[TV Like] Local favorites unavailable', error);
                setLocalFavorite({
                    songId: localSongId,
                    loading: false,
                    localSong: null,
                    isLiked: false,
                });
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [localSongId]);

    useEffect(() => {
        if (!notice) return undefined;
        const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);
        return () => window.clearTimeout(timer);
    }, [notice]);

    useEffect(() => {
        setNotice(null);
        if (sourceKind !== 'local') setPendingSongId(null);
    }, [songKey, sourceKind]);

    const localState = localFavorite?.songId === localSongId ? localFavorite : null;
    const localPending = Boolean(localSongId && pendingSongId === localSongId);
    const onlineLiked = useMemo(() => {
        if (!account || !song || sourceKind !== 'online') return false;
        return omni.isSongLiked(song);
    }, [account, song, sourceKind]);
    const isLiked = sourceKind === 'online'
        ? onlineLiked
        : sourceKind === 'local'
            ? Boolean(localState?.isLiked)
            : false;
    const disabledReason = sourceKind === 'online'
        && song
        && providerId
        && !omni.canLikeSong(song)
        ? t('status.providerLikeUnavailable', {
            provider: omni.getProviderLabel(providerId),
        })
        : undefined;
    const disabled = !song
        || sourceKind === 'stage'
        || (sourceKind === 'local' && (
            !localState
            || localState.loading
            || !localState.localSong
        ))
        || (sourceKind === 'online' && Boolean(disabledReason))
        || (sourceKind !== 'online' && sourceKind !== 'local');
    const currentNotice = notice?.songKey === songKey
        ? { tone: notice.tone, text: notice.text }
        : null;

    const showNotice = useCallback((songKeyAtPress: string, next: TvSongLikeNotice) => {
        if (songKeyRef.current !== songKeyAtPress) return;
        setNotice({ ...next, songKey: songKeyAtPress });
    }, []);

    const toggle = useCallback(() => {
        if (!song || !songKey) return;

        if (sourceKind === 'local') {
            const localSong = localState?.localSong;
            if (!localSong || localWriteRef.current === localSong.id) return;
            if (pendingSongId === localSong.id) return;
            const localFavoriteState = localState;

            const nextLiked = !localFavoriteState.isLiked;
            localWriteRef.current = localSong.id;
            setPendingSongId(localSong.id);
            void (async () => {
                try {
                    const playlist = await setLocalSongFavorite(localSong, nextLiked);
                    if (!playlist) throw new Error('Favorite playlist is unavailable');
                    setLocalFavorite(current => (
                        current?.songId === localSong.id
                            ? { ...current, isLiked: nextLiked }
                            : current
                    ));
                    showNotice(songKey, {
                        tone: 'success',
                        text: nextLiked ? t('status.liked') : t('status.unliked'),
                    });
                } catch (error) {
                    console.warn('[TV Like] Local favorite write failed', error);
                    showNotice(songKey, {
                        tone: 'error',
                        text: t('status.likeFailed'),
                    });
                } finally {
                    if (localWriteRef.current === localSong.id) localWriteRef.current = null;
                    setPendingSongId(current => (current === localSong.id ? null : current));
                }
            })();
            return;
        }

        if (sourceKind !== 'online' || !omni.canLikeSong(song)) return;
        const pressedForAccount = accountId;
        try {
            const press = omni.pressSongLike(song);
            showNotice(songKey, {
                tone: 'success',
                text: press.wanted ? t('status.liked') : t('status.unliked'),
            });
            void press.settled.then(outcome => {
                if (outcome.ok) {
                    if (accountIdRef.current === pressedForAccount) {
                        onLikeChanged?.(song, outcome.liked);
                    }
                    return;
                }
                console.warn('[TV Like] Provider like request failed', outcome.error);
                showNotice(songKey, {
                    tone: 'error',
                    text: t('status.likeFailed'),
                });
            });
        } catch (error) {
            console.warn('[TV Like] Like request could not be sent', error);
            showNotice(songKey, {
                tone: 'error',
                text: t('status.likeFailed'),
            });
        }
    }, [
        accountId,
        localState,
        onLikeChanged,
        pendingSongId,
        showNotice,
        song,
        songKey,
        sourceKind,
        t,
    ]);

    return {
        isLiked,
        disabled,
        disabledReason,
        pending: localPending,
        notice: currentNotice,
        toggle,
    };
};
