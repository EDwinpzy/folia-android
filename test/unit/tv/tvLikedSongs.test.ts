import { describe, expect, it } from 'vitest';
import {
    applyTvLikedSongChange,
    isTvLikedSnapshotCurrent,
    mergeTvLikedSongChanges,
    resolveTvLikedOwnerKey,
} from '../../../src/tv/model/tvLikedSongs';
import type { SongResult } from '../../../src/types';

const song = (mediaId: string): SongResult => ({
    id: mediaId,
    name: mediaId,
    artists: [],
    album: { id: '', name: '' },
    durationMs: 1,
    sourceRef: { kind: 'online', providerId: 'netease', mediaId },
});

describe('TV liked-song ownership', () => {
    it('separates providers, accounts and liked collections', () => {
        expect(resolveTvLikedOwnerKey('netease', 'account-a', null)).toBe(
            'netease:account-a:provider',
        );
        expect(resolveTvLikedOwnerKey('netease', 'account-b', null)).not.toBe(
            resolveTvLikedOwnerKey('netease', 'account-a', null),
        );
        expect(resolveTvLikedOwnerKey('kugou', 'account-a', null)).not.toBe(
            resolveTvLikedOwnerKey('netease', 'account-a', null),
        );
        expect(resolveTvLikedOwnerKey('netease', 'account-a', 'liked-a')).not.toBe(
            resolveTvLikedOwnerKey('netease', 'account-a', 'liked-b'),
        );
    });

    it('does not expose the previous account snapshot while the next account loads', () => {
        const accountA = resolveTvLikedOwnerKey('netease', 'account-a', null);
        const accountB = resolveTvLikedOwnerKey('netease', 'account-b', null);

        expect(isTvLikedSnapshotCurrent(accountA, accountA)).toBe(true);
        expect(isTvLikedSnapshotCurrent(accountA, accountB)).toBe(false);
        expect(isTvLikedSnapshotCurrent(null, null)).toBe(false);
    });

    it('adds a liked song once and removes it on unlike', () => {
        const first = song('first');
        const second = song('second');
        const liked = applyTvLikedSongChange([first], { song: second, liked: true });

        expect(liked).toEqual([second, first]);
        expect(applyTvLikedSongChange(liked, { song: second, liked: true })).toBe(liked);
        expect(applyTvLikedSongChange(liked, { song: second, liked: false })).toEqual([first]);
        expect(applyTvLikedSongChange([first], { song: second, liked: false })).toEqual([first]);
    });

    it('applies changes made while the liked list was loading in order', () => {
        const first = song('first');
        const second = song('second');
        const changes = [
            { song: first, liked: true },
            { song: second, liked: true },
            { song: first, liked: false },
        ];

        expect(mergeTvLikedSongChanges([], changes)).toEqual([second]);
    });
});
