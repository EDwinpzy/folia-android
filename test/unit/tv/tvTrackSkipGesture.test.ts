// test/unit/tv/tvTrackSkipGesture.test.ts

import { describe, expect, it } from 'vitest';
import {
    createTvTrackSkipGesture,
    handleTvPlayerHorizontalAction,
    TV_TRACK_SKIP_INTERVAL_MS,
} from '../../../src/tv/input/tvTrackSkipGesture';

describe('TV track skip gesture', () => {
    it('skips after two presses in the same direction inside the time window', () => {
        const gesture = createTvTrackSkipGesture(420);

        expect(gesture.press('left', 1_000)).toBe(false);
        expect(gesture.press('left', 1_200)).toBe(true);
        expect(gesture.press('left', 1_250)).toBe(false);
    });

    it('does not pair different directions or presses outside the time window', () => {
        const gesture = createTvTrackSkipGesture(420);

        expect(gesture.press('left', 1_000)).toBe(false);
        expect(gesture.press('right', 1_100)).toBe(false);
        expect(gesture.press('right', 1_600)).toBe(false);
    });

    it('recognizes a second press at the configured reveal deadline', () => {
        const gesture = createTvTrackSkipGesture();

        expect(gesture.press('right', 1_000)).toBe(false);
        expect(gesture.press('right', 1_000 + TV_TRACK_SKIP_INTERVAL_MS)).toBe(true);
    });

    it('can be cleared when focus moves to another control layer', () => {
        const gesture = createTvTrackSkipGesture();

        expect(gesture.press('right', 1_000)).toBe(false);
        gesture.clear();
        expect(gesture.press('right', 1_100)).toBe(false);
    });

    it('moves focus instead of skipping while player chrome is visible', () => {
        const calls: string[] = [];
        const gesture = {
            press: () => {
                calls.push('press');
                return true;
            },
            clear: () => calls.push('clear'),
        };

        expect(handleTvPlayerHorizontalAction({
            route: { page: 'player', overlay: 'controls' },
            action: 'right',
            repeat: false,
            now: 1_000,
            gesture,
            cancelPendingChromeReveal: () => calls.push('cancel'),
            scheduleChromeReveal: () => calls.push('schedule'),
            skipPrevious: () => calls.push('previous'),
            next: () => calls.push('next'),
            moveFocus: direction => calls.push(`focus:${direction}`),
        })).toBe(true);
        expect(calls).toEqual(['cancel', 'clear', 'focus:right']);
    });

    it('keeps the hidden-player double press assigned to track skipping', () => {
        const calls: string[] = [];
        const gesture = {
            press: () => true,
            clear: () => calls.push('clear'),
        };

        expect(handleTvPlayerHorizontalAction({
            route: { page: 'player', overlay: null },
            action: 'left',
            repeat: false,
            now: 1_000,
            gesture,
            cancelPendingChromeReveal: () => calls.push('cancel'),
            scheduleChromeReveal: () => calls.push('schedule'),
            skipPrevious: () => calls.push('previous'),
            next: () => calls.push('next'),
            moveFocus: direction => calls.push(`focus:${direction}`),
        })).toBe(true);
        expect(calls).toEqual(['cancel', 'previous']);
    });

    it('schedules player chrome after a single hidden horizontal press', () => {
        const calls: string[] = [];
        const gesture = {
            press: () => false,
            clear: () => calls.push('clear'),
        };

        expect(handleTvPlayerHorizontalAction({
            route: { page: 'player', overlay: null },
            action: 'right',
            repeat: false,
            now: 1_000,
            gesture,
            cancelPendingChromeReveal: () => calls.push('cancel'),
            scheduleChromeReveal: () => calls.push('schedule'),
            skipPrevious: () => calls.push('previous'),
            next: () => calls.push('next'),
            moveFocus: direction => calls.push(`focus:${direction}`),
        })).toBe(true);
        expect(calls).toEqual(['schedule']);
    });
});
