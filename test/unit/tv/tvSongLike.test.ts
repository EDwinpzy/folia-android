import { describe, expect, it } from 'vitest';
import { resolveTvLocalSongFavorite } from '../../../src/tv/model/tvSongLike';
import type { LocalSong } from '../../../src/types';

const createSong = (
    id: string,
    filePath: string,
    addedAt: number,
): LocalSong => ({
    id,
    fileName: filePath.split('/').pop() || 'track.mp3',
    filePath,
    title: 'Track',
    titleOrigin: 'import',
    importedMetadata: {
        title: 'Track',
        titleSource: 'filename',
        artistNames: [],
    },
    duration: 1000,
    fileSize: 1234,
    fileLastModified: 1000,
    mimeType: 'audio/mpeg',
    addedAt,
    folderName: filePath.split('/')[0],
});

describe('TV local song favorite', () => {
    it('reads the favorite playlist through the repeated import canonical id', () => {
        const original = createSong('original', 'Library/Disc 1/Track 01.mp3', 100);
        const duplicate = createSong('duplicate', 'Library (2)/Disc 1/Track 01.mp3', 200);

        const favorite = resolveTvLocalSongFavorite(
            'duplicate',
            [original, duplicate],
            ['original'],
        );

        expect(favorite.localSong).toBe(duplicate);
        expect(favorite.isLiked).toBe(true);
    });

    it('leaves a song outside the favorite playlist unliked and reports a missing record', () => {
        const song = createSong('song', 'Library/Track.mp3', 100);

        expect(resolveTvLocalSongFavorite('song', [song], [])).toEqual({
            localSong: song,
            isLiked: false,
        });
        expect(resolveTvLocalSongFavorite('missing', [song], ['song'])).toEqual({
            localSong: null,
            isLiked: false,
        });
    });
});
