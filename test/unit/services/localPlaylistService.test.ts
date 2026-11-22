import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    buildCanonicalLocalSongIdIndex,
    getLocalPlaylists,
    removeSongsFromAllLocalPlaylists,
    setLocalSongFavorite,
} from '@/services/localPlaylistService';
import { getFromCache, getLocalSongs, saveToCacheOrThrow } from '@/services/db';
import type { LocalPlaylist, LocalSong } from '@/types';

// test/unit/services/localPlaylistService.test.ts
// Covers local playlist cache repair for repeated folder imports.

vi.mock('@/services/db', () => ({
    getFromCache: vi.fn(),
    getLocalSongs: vi.fn(),
    saveToCacheOrThrow: vi.fn(),
}));

const createSong = (patch: Partial<LocalSong> & Pick<LocalSong, 'id' | 'filePath' | 'folderName'>): LocalSong => {
    const { id, filePath, folderName, ...songPatch } = patch;
    return {
        id,
        fileName: songPatch.fileName || filePath.split('/').pop() || 'song.mp3',
        filePath,
        title: songPatch.title || (songPatch.fileName || filePath.split('/').pop() || 'song.mp3').replace(/\.[^.]+$/, ''),
        titleOrigin: songPatch.titleOrigin || 'import',
        importedMetadata: songPatch.importedMetadata || {
            title: songPatch.title || (songPatch.fileName || filePath.split('/').pop() || 'song.mp3').replace(/\.[^.]+$/, ''),
            titleSource: 'filename',
            artistNames: [],
        },
        duration: songPatch.duration ?? 0,
        fileSize: songPatch.fileSize ?? 1234,
        fileLastModified: songPatch.fileLastModified ?? 1000,
        mimeType: songPatch.mimeType || 'audio/mpeg',
        addedAt: songPatch.addedAt ?? 100,
        folderName,
        ...songPatch,
    };
};

describe('localPlaylistService', () => {
    beforeEach(() => {
        vi.mocked(getFromCache).mockReset();
        vi.mocked(getLocalSongs).mockReset();
        vi.mocked(saveToCacheOrThrow).mockReset();
    });

    it('keeps same child folder and file names from different roots distinct', async () => {
        const alphaSong = createSong({
            id: 'alpha',
            filePath: 'RootA/Disc 1/Track 01.mp3',
            folderName: 'RootA/Disc 1',
        });
        const betaSong = createSong({
            id: 'beta',
            filePath: 'RootB/Disc 1/Track 01.mp3',
            folderName: 'RootB/Disc 1',
        });
        const playlists: LocalPlaylist[] = [{
            id: 'playlist',
            name: 'Both roots',
            songIds: ['alpha', 'beta'],
            createdAt: 1,
            updatedAt: 1,
        }];

        vi.mocked(getFromCache).mockResolvedValue(playlists);
        vi.mocked(getLocalSongs).mockResolvedValue([alphaSong, betaSong]);

        const result = await getLocalPlaylists();

        expect(result.find(playlist => playlist.id === 'playlist')?.songIds).toEqual(['alpha', 'beta']);
        expect(saveToCacheOrThrow).toHaveBeenCalledWith('local_playlists', expect.arrayContaining([
            expect.objectContaining({ isFavorite: true }),
            expect.objectContaining({ id: 'playlist', songIds: ['alpha', 'beta'] }),
        ]));
    });

    it('repairs repeated imports from the same root family to the canonical song id', async () => {
        const originalSong = createSong({
            id: 'original',
            filePath: 'Library/Disc 1/Track 01.mp3',
            folderName: 'Library/Disc 1',
            addedAt: 100,
        });
        const duplicatedSong = createSong({
            id: 'duplicate',
            filePath: 'Library (2)/Disc 1/Track 01.mp3',
            folderName: 'Library (2)/Disc 1',
            addedAt: 200,
        });
        const playlists: LocalPlaylist[] = [{
            id: 'playlist',
            name: 'Repeated imports',
            songIds: ['duplicate', 'original', 'duplicate'],
            createdAt: 1,
            updatedAt: 1,
        }];

        vi.mocked(getFromCache).mockResolvedValue(playlists);
        vi.mocked(getLocalSongs).mockResolvedValue([originalSong, duplicatedSong]);

        const result = await getLocalPlaylists();

        expect(result.find(playlist => playlist.id === 'playlist')?.songIds).toEqual(['original']);
        expect(saveToCacheOrThrow).toHaveBeenCalledWith('local_playlists', expect.arrayContaining([
            expect.objectContaining({ id: 'playlist', songIds: ['original'] }),
        ]));
    });

    it('favorites and unfavorites a repeated import through the canonical song id', async () => {
        const originalSong = createSong({
            id: 'original',
            filePath: 'Library/Disc 1/Track 01.mp3',
            folderName: 'Library/Disc 1',
            addedAt: 100,
        });
        const duplicatedSong = createSong({
            id: 'duplicate',
            filePath: 'Library (2)/Disc 1/Track 01.mp3',
            folderName: 'Library (2)/Disc 1',
            addedAt: 200,
        });
        const cacheState = new Map<string, unknown>([['local_playlists', [{
            id: 'favorite',
            name: 'Liked Songs',
            songIds: [],
            createdAt: 1,
            updatedAt: 1,
            isFavorite: true,
        }]]]);
        vi.mocked(getFromCache).mockImplementation(async key => (cacheState.get(key) ?? null) as never);
        vi.mocked(saveToCacheOrThrow).mockImplementation(async (key, data) => { cacheState.set(key, data); });
        vi.mocked(getLocalSongs).mockResolvedValue([originalSong, duplicatedSong]);

        // 播放中的是第二次导入的副本，但歌单里只会留下 canonical 那一份的 id。
        await setLocalSongFavorite(duplicatedSong, true);
        const afterFavorite = await getLocalPlaylists();
        expect(afterFavorite.find(playlist => playlist.isFavorite)?.songIds).toEqual(['original']);

        await setLocalSongFavorite(duplicatedSong, false);
        const afterUnfavorite = await getLocalPlaylists();
        expect(afterUnfavorite.find(playlist => playlist.isFavorite)?.songIds).toEqual([]);
    });

    it('serializes concurrent favorites so both songs stay in the favorite playlist', async () => {
        const firstSong = createSong({
            id: 'first',
            filePath: 'Library/First.mp3',
            folderName: 'Library',
        });
        const secondSong = createSong({
            id: 'second',
            filePath: 'Library/Second.mp3',
            folderName: 'Library',
        });
        const cacheState = new Map<string, unknown>([['local_playlists', [{
            id: 'favorite',
            name: 'Liked Songs',
            songIds: [],
            createdAt: 1,
            updatedAt: 1,
            isFavorite: true,
        }]]]);
        let releaseFirstWrite = () => {};
        let markFirstWriteStarted = () => {};
        const firstWrite = new Promise<void>(resolve => {
            releaseFirstWrite = resolve;
        });
        const firstWriteStarted = new Promise<void>(resolve => {
            markFirstWriteStarted = resolve;
        });
        vi.mocked(getFromCache).mockImplementation(key => Promise.resolve(cacheState.get(key) as never));
        vi.mocked(saveToCacheOrThrow)
            .mockImplementationOnce((_key, data) => {
                markFirstWriteStarted();
                return firstWrite.then(() => {
                    cacheState.set('local_playlists', data);
                });
            })
            .mockImplementation((_key, data) => {
                cacheState.set('local_playlists', data);
                return Promise.resolve();
            });
        vi.mocked(getLocalSongs).mockResolvedValue([firstSong, secondSong]);

        const firstFavorite = setLocalSongFavorite(firstSong, true);
        await firstWriteStarted;
        const secondFavorite = setLocalSongFavorite(secondSong, true);
        await Promise.resolve();
        expect(saveToCacheOrThrow).toHaveBeenCalledTimes(1);
        releaseFirstWrite();
        await Promise.all([firstFavorite, secondFavorite]);

        const playlists = await getLocalPlaylists();
        expect(playlists.find(playlist => playlist.isFavorite)?.songIds).toEqual([
            'first',
            'second',
        ]);
    });

    it('does not let a song cleanup overwrite a favorite written just before it', async () => {
        const oldSong = createSong({
            id: 'old',
            filePath: 'Library/Old.mp3',
            folderName: 'Library',
        });
        const newSong = createSong({
            id: 'new',
            filePath: 'Library/New.mp3',
            folderName: 'Library',
        });
        const keepSong = createSong({
            id: 'keep',
            filePath: 'Library/Keep.mp3',
            folderName: 'Library',
        });
        const cacheState = new Map<string, unknown>([['local_playlists', [
            {
                id: 'favorite',
                name: 'Liked Songs',
                songIds: ['old'],
                createdAt: 1,
                updatedAt: 1,
                isFavorite: true,
            },
            {
                id: 'playlist',
                name: 'Mixed',
                songIds: ['old', 'keep'],
                createdAt: 1,
                updatedAt: 1,
            },
        ]]]);
        let releaseFavoriteWrite = () => {};
        let markFavoriteWriteStarted = () => {};
        const favoriteWrite = new Promise<void>(resolve => {
            releaseFavoriteWrite = resolve;
        });
        const favoriteWriteStarted = new Promise<void>(resolve => {
            markFavoriteWriteStarted = resolve;
        });
        vi.mocked(getFromCache).mockImplementation(key => Promise.resolve(cacheState.get(key) as never));
        vi.mocked(saveToCacheOrThrow)
            .mockImplementationOnce((_key, data) => {
                markFavoriteWriteStarted();
                return favoriteWrite.then(() => {
                    cacheState.set('local_playlists', data);
                });
            })
            .mockImplementation((_key, data) => {
                cacheState.set('local_playlists', data);
                return Promise.resolve();
            });
        vi.mocked(getLocalSongs).mockResolvedValue([oldSong, newSong, keepSong]);

        const favorite = setLocalSongFavorite(newSong, true);
        await favoriteWriteStarted;
        const cleanup = removeSongsFromAllLocalPlaylists(['old']);
        await Promise.resolve();
        expect(saveToCacheOrThrow).toHaveBeenCalledTimes(1);

        releaseFavoriteWrite();
        await Promise.all([favorite, cleanup]);

        const playlists = await getLocalPlaylists();
        expect(playlists.find(playlist => playlist.isFavorite)?.songIds).toEqual(['new']);
        expect(playlists.find(playlist => playlist.id === 'playlist')?.songIds).toEqual(['keep']);
    });

    it('rejects a favorite when the playlist did not reach storage', async () => {
        const song = createSong({
            id: 'song',
            filePath: 'Library/Song.mp3',
            folderName: 'Library',
        });
        vi.mocked(getFromCache).mockResolvedValue([{
            id: 'favorite',
            name: 'Liked Songs',
            songIds: [],
            createdAt: 1,
            updatedAt: 1,
            isFavorite: true,
        }]);
        vi.mocked(getLocalSongs).mockResolvedValue([song]);
        vi.mocked(saveToCacheOrThrow).mockRejectedValue(new Error('disk full'));

        await expect(setLocalSongFavorite(song, true)).rejects.toThrow('disk full');
    });

    it('indexes only the repeated imports that resolve to another song id', () => {
        const originalSong = createSong({
            id: 'original',
            filePath: 'Library/Disc 1/Track 01.mp3',
            folderName: 'Library/Disc 1',
            addedAt: 100,
        });
        const duplicatedSong = createSong({
            id: 'duplicate',
            filePath: 'Library (2)/Disc 1/Track 01.mp3',
            folderName: 'Library (2)/Disc 1',
            addedAt: 200,
        });
        const soleSong = createSong({
            id: 'sole',
            filePath: 'Other/Track 09.mp3',
            folderName: 'Other',
        });

        const index = buildCanonicalLocalSongIdIndex([originalSong, duplicatedSong, soleSong]);

        expect(index.get('duplicate')).toBe('original');
        expect(index.has('original')).toBe(false);
        expect(index.has('sole')).toBe(false);
    });
});
