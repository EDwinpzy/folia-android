// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// test/unit/tv/useTvSongLike.test.ts
// The player's heart over both favorite paths: the local favorite playlist and an online provider.

const mocks = vi.hoisted(() => ({
    getLocalSongs: vi.fn(),
    getLocalPlaylists: vi.fn(),
    setLocalSongFavorite: vi.fn(),
    pressSongLike: vi.fn(),
    isSongLiked: vi.fn(),
    canLikeSong: vi.fn(),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/services/db', () => ({
    getLocalSongs: mocks.getLocalSongs,
}));

vi.mock('@/services/localPlaylistService', () => ({
    getLocalPlaylists: mocks.getLocalPlaylists,
    setLocalSongFavorite: mocks.setLocalSongFavorite,
    resolveCanonicalLocalSongId: (songId: string) => songId,
}));

vi.mock('@/services/onlineMusic/omni', () => ({
    omni: {
        pressSongLike: mocks.pressSongLike,
        isSongLiked: mocks.isSongLiked,
        canLikeSong: mocks.canLikeSong,
        getProviderLabel: () => 'NetEase',
    },
}));

import { useOnlineProviderAccountStore } from '@/stores/useOnlineProviderAccountStore';
import type { LocalPlaylist, LocalSong, SongResult } from '@/types';
import {
    useTvSongLike,
    type TvSongLikeModel,
} from '@/tv/hooks/useTvSongLike';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const localRecord: LocalSong = {
    id: 'local-song',
    fileName: 'Local.mp3',
    filePath: 'Library/Local.mp3',
    title: 'Local',
    titleOrigin: 'import',
    importedMetadata: { title: 'Local', titleSource: 'filename', artistNames: [] },
    duration: 1000,
    fileSize: 1234,
    fileLastModified: 1000,
    mimeType: 'audio/mpeg',
    addedAt: 100,
    folderName: 'Library',
};

const localSong = {
    id: 'local-song',
    name: 'Local',
    artists: [],
    album: { id: '', name: '' },
    durationMs: 1000,
    isLocal: true,
    localRef: { songId: 'local-song' },
} as unknown as SongResult;

const onlineSong = (mediaId: string): SongResult => ({
    id: mediaId,
    name: mediaId,
    artists: [],
    album: { id: '', name: '' },
    durationMs: 1000,
    sourceRef: { kind: 'online', providerId: 'netease', mediaId },
});

const favoritePlaylist = (songIds: string[] = []): LocalPlaylist => ({
    id: 'favorite',
    name: 'Liked Songs',
    songIds,
    createdAt: 1,
    updatedAt: 1,
    isFavorite: true,
});

let container: HTMLDivElement;
let root: Root;
let latest: TvSongLikeModel | null = null;

const Probe = ({
    song,
    onLikeChanged,
}: {
    song: SongResult | null;
    onLikeChanged?: (song: SongResult, liked: boolean) => void;
}) => {
    latest = useTvSongLike(song, onLikeChanged);
    return null;
};

const render = async (
    song: SongResult | null,
    onLikeChanged?: (song: SongResult, liked: boolean) => void,
) => {
    act(() => {
        root.render(createElement(Probe, { song, onLikeChanged }));
    });
    await act(async () => {});
};

const flush = async () => {
    await act(async () => {});
};

beforeEach(() => {
    mocks.getLocalSongs.mockReset();
    mocks.getLocalPlaylists.mockReset();
    mocks.setLocalSongFavorite.mockReset();
    mocks.pressSongLike.mockReset();
    mocks.isSongLiked.mockReset().mockReturnValue(false);
    mocks.canLikeSong.mockReset().mockReturnValue(true);
    useOnlineProviderAccountStore.setState({
        accounts: {
            netease: {
                status: 'authenticated',
                user: { id: 'account', nickname: 'Account' },
                collections: [],
                likedSongIds: [],
                wantedLikes: {},
                hydration: 'ready',
                freshness: 'fresh',
            },
        },
        activeProviderId: 'netease',
    });
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    latest = null;
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

describe('TV player song like', () => {
    it('favorites a local song and shows the result', async () => {
        mocks.getLocalSongs.mockResolvedValue([localRecord]);
        mocks.getLocalPlaylists.mockResolvedValue([favoritePlaylist()]);
        mocks.setLocalSongFavorite.mockResolvedValue(favoritePlaylist(['local-song']));
        await render(localSong);

        expect(latest?.isLiked).toBe(false);
        expect(latest?.disabled).toBe(false);

        await act(async () => {
            latest?.toggle();
            await Promise.resolve();
        });

        expect(mocks.setLocalSongFavorite).toHaveBeenCalledWith(localRecord, true);
        expect(latest?.isLiked).toBe(true);
        expect(latest?.notice).toEqual({ tone: 'success', text: 'status.liked' });
    });

    it('reports a local write that did not reach storage', async () => {
        mocks.getLocalSongs.mockResolvedValue([localRecord]);
        mocks.getLocalPlaylists.mockResolvedValue([favoritePlaylist()]);
        mocks.setLocalSongFavorite.mockRejectedValue(new Error('disk full'));
        await render(localSong);

        await act(async () => {
            latest?.toggle();
            await Promise.resolve();
        });

        expect(latest?.isLiked).toBe(false);
        expect(latest?.notice).toEqual({ tone: 'error', text: 'status.likeFailed' });
    });

    it('notifies the library once an online like settles', async () => {
        const song = onlineSong('online-song');
        const onLikeChanged = vi.fn();
        mocks.pressSongLike.mockReturnValue({
            wanted: true,
            joined: false,
            settled: Promise.resolve({ ok: true, liked: true }),
        });
        await render(song, onLikeChanged);

        await act(async () => {
            latest?.toggle();
            await Promise.resolve();
        });

        expect(onLikeChanged).toHaveBeenCalledWith(song, true);
        expect(latest?.notice).toEqual({ tone: 'success', text: 'status.liked' });
    });

    it('reports an online request that failed', async () => {
        let settle: (outcome: { ok: false; error: Error }) => void = () => {};
        const settled = new Promise<{ ok: false; error: Error }>(resolve => {
            settle = resolve;
        });
        mocks.pressSongLike.mockReturnValue({
            wanted: true,
            joined: false,
            settled,
        });
        await render(onlineSong('online-song'));

        await act(async () => {
            latest?.toggle();
            await Promise.resolve();
        });
        expect(latest?.notice).toEqual({ tone: 'success', text: 'status.liked' });

        await act(async () => {
            settle({ ok: false, error: new Error('no answer') });
            await settled;
        });

        expect(latest?.notice).toEqual({ tone: 'error', text: 'status.likeFailed' });
    });

    it('does not show a failed request for the song that is no longer playing', async () => {
        let settle: (outcome: { ok: false; error: Error }) => void = () => {};
        const settled = new Promise<{ ok: false; error: Error }>(resolve => {
            settle = resolve;
        });
        mocks.pressSongLike.mockReturnValue({
            wanted: true,
            joined: false,
            settled,
        });
        await render(onlineSong('first-song'));

        await act(async () => {
            latest?.toggle();
            await Promise.resolve();
        });
        await render(onlineSong('second-song'));

        await act(async () => {
            settle({ ok: false, error: new Error('no answer') });
            await settled;
        });
        await flush();

        expect(latest?.notice).toBeNull();
    });

    it('keeps the pressed song pending when another local song starts', async () => {
        const secondRecord: LocalSong = {
            ...localRecord,
            id: 'second-local',
            fileName: 'Second.mp3',
            filePath: 'Library/Second.mp3',
            title: 'Second',
            importedMetadata: { title: 'Second', titleSource: 'filename', artistNames: [] },
        };
        const secondSong = {
            ...localSong,
            id: 'second-local',
            name: 'Second',
            localRef: { songId: 'second-local' },
        } as unknown as SongResult;
        let finishWrite: () => void = () => {};
        mocks.getLocalSongs.mockResolvedValue([localRecord, secondRecord]);
        mocks.getLocalPlaylists.mockResolvedValue([favoritePlaylist()]);
        mocks.setLocalSongFavorite.mockImplementation(() => new Promise(resolve => {
            finishWrite = () => resolve(favoritePlaylist(['local-song']));
        }));
        await render(localSong);

        await act(async () => {
            latest?.toggle();
            await Promise.resolve();
        });
        await render(secondSong);

        await act(async () => {
            finishWrite();
            await Promise.resolve();
        });

        expect(mocks.setLocalSongFavorite).toHaveBeenCalledTimes(1);
        expect(latest?.pending).toBe(false);
        expect(latest?.notice).toBeNull();
    });
});
