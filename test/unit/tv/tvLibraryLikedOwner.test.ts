// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SongResult } from '../../../src/types';

const deferred = vi.hoisted(() => ({
    resolveAccountB: null as (() => void) | null,
    firstLikedReadStarted: null as (() => void) | null,
    resolveFirstLikedRead: null as (() => void) | null,
}));

vi.mock('../../../src/services/db', () => ({
    getLocalSongs: vi.fn(async () => []),
}));

vi.mock('../../../src/services/playbackAdapters', () => ({
    buildLocalQueue: vi.fn((songs: unknown[]) => songs),
}));

vi.mock('../../../src/services/onlineMusic/omni', () => ({
    omni: {
        getProviderLikedSongIds: vi.fn(async (_providerId: string, userId: string) => {
            if (userId === 'account-b') {
                await new Promise<void>(resolve => {
                    deferred.resolveAccountB = resolve;
                });
            }
            if (userId === 'account-hold') {
                await new Promise<void>(resolve => {
                    deferred.resolveFirstLikedRead = resolve;
                    deferred.firstLikedReadStarted?.();
                });
            }
            return { ids: [`${userId}-song`] };
        }),
        getSongDetails: vi.fn(async (providerId: string, ids: string[]) => ids.map(id => ({
            status: 'found',
            song: {
                id,
                name: id,
                artists: [],
                album: { id: '', name: '' },
                durationMs: 1,
                sourceRef: { kind: 'online', providerId, mediaId: id },
            },
        }))),
    },
}));

import {
    useTvLibrary,
    type TvLibraryModel,
} from '../../../src/tv/hooks/useTvLibrary';
import type { TvAccountModel } from '../../../src/tv/hooks/useTvAccount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const accountFor = (userId: string | null): TvAccountModel => ({
    activeProviderId: 'netease',
    activeAccount: userId === null
        ? null
        : {
            user: { id: userId },
            collections: [],
        },
}) as unknown as TvAccountModel;

let container: HTMLDivElement;
let root: Root;
let library: TvLibraryModel | null = null;

const Probe = ({ account }: { account: TvAccountModel }) => {
    library = useTvLibrary(account);
    return null;
};

const renderAccount = async (userId: string | null) => {
    await act(async () => {
        root.render(createElement(Probe, { account: accountFor(userId) }));
    });
    await act(async () => {});
};

beforeEach(() => {
    deferred.resolveAccountB = null;
    deferred.firstLikedReadStarted = null;
    deferred.resolveFirstLikedRead = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

describe('useTvLibrary liked-song ownership', () => {
    it('drops the previous account snapshot as soon as the account changes', async () => {
        await renderAccount('account-a');
        expect(library?.likedSongs.map(song => song.id)).toEqual(['account-a-song']);
        expect(library?.isLoadingLiked).toBe(false);

        await renderAccount('account-b');
        expect(library?.likedSongs).toEqual([]);
        expect(library?.isLoadingLiked).toBe(true);

        await act(async () => deferred.resolveAccountB?.());
        expect(library?.likedSongs.map(song => song.id)).toEqual(['account-b-song']);
        expect(library?.isLoadingLiked).toBe(false);
    });

    it('keeps a like made while the liked list is loading', async () => {
        const firstReadStarted = new Promise<void>(resolve => {
            deferred.firstLikedReadStarted = resolve;
        });
        await act(async () => {
            root.render(createElement(Probe, { account: accountFor('account-hold') }));
        });
        await firstReadStarted;

        const likedSong: SongResult = {
            id: 'liked-now',
            name: 'Liked now',
            artists: [],
            album: { id: '', name: '' },
            durationMs: 1,
            sourceRef: { kind: 'online', providerId: 'netease', mediaId: 'liked-now' },
        };
        act(() => {
            library?.applyLikedSongChange(likedSong, true);
        });
        expect(library?.likedSongs).toEqual([]);

        await act(async () => deferred.resolveFirstLikedRead?.());
        expect(library?.likedSongs.map(song => song.id)).toEqual([
            'liked-now',
            'account-hold-song',
        ]);
    });
});
