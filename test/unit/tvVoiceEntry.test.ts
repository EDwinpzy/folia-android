import { describe, expect, it } from 'vitest';
import { selectTvVoiceNamedItem } from '../../src/tv/model/tvVoiceEntry';

describe('selectTvVoiceNamedItem', () => {
    const items = [
        { id: 1, name: '车载MP3永久保留曲目' },
        { id: 2, name: '史上最好听中文歌' },
        { id: 3, name: '音乐云盘' },
    ];

    it('prefers an exact name', () => {
        expect(selectTvVoiceNamedItem(items, '音乐云盘')?.id).toBe(3);
    });

    it('accepts a spoken prefix and ignores punctuation', () => {
        expect(selectTvVoiceNamedItem(items, '车载 MP3')?.id).toBe(1);
    });

    it('returns null when nothing matches or the query is empty', () => {
        expect(selectTvVoiceNamedItem(items, '不存在的歌单')).toBeNull();
        expect(selectTvVoiceNamedItem(items, '')).toBeNull();
    });

    it('returns null when multiple cards match the same spoken prefix', () => {
        const ambiguous = [
            { id: 1, name: '车载音乐一' },
            { id: 2, name: '车载音乐二' },
        ];

        expect(selectTvVoiceNamedItem(ambiguous, '车载')).toBeNull();
    });

    it('prefers a unique prefix over a unique substring', () => {
        const mixed = [
            { id: 1, name: '我的车载合集' },
            { id: 2, name: '车载音乐' },
        ];

        expect(selectTvVoiceNamedItem(mixed, '车载')?.id).toBe(2);
    });
});
