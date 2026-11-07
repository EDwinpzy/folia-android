// src/car/TvCarToolbar.tsx

import {
    BadgeCheck,
    Car,
    FolderOpen,
    Music2,
    Pause,
    Play,
    RefreshCw,
    SkipBack,
    SkipForward,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getSongArtistLabel } from '../services/onlineMusic/songMetadata';
import type { TvPlayerModel } from '../tv/model/tvTypes';
import { resolveTvSongCoverUrl, TV_COVER_SIZE } from '../tv/services/tvPlaybackSource';
import { useCarLibraryActions } from './useCarLibraryActions';

const resolveActionMessage = (
    result: ReturnType<typeof useCarLibraryActions>['result'],
    t: (key: string, options?: Record<string, unknown>) => string,
): string | null => {
    if (!result) return null;
    if (result.status === 'error') return t('tv.car.actionFailed');
    if (result.status === 'unavailable') return t('tv.car.unavailable');
    if (result.status === 'empty') return t('tv.car.empty');
    if (result.kind === 'scan') return t('tv.car.scanDone', { count: result.count ?? 0 });
    if (result.kind === 'import') return t('tv.car.importDone', { count: result.count ?? 0 });
    return t('tv.car.settingsOpened');
};

export const TvCarToolbar = ({
    player,
    refreshLocalSongs,
    onActivateHero,
    onOpenPlayer,
}: {
    player: TvPlayerModel;
    refreshLocalSongs: () => Promise<number>;
    onActivateHero: () => void;
    onOpenPlayer: () => void;
}) => {
    const { t } = useTranslation();
    const actions = useCarLibraryActions(refreshLocalSongs);
    const song = player.currentSong;
    const coverUrl = resolveTvSongCoverUrl(song, TV_COVER_SIZE.row);
    const isPlaying = player.status === 'playing';
    const actionMessage = resolveActionMessage(actions.result, t);
    const transportLabel = isPlaying ? t('tv.player.pause') : t('tv.player.play');

    const togglePlayback = () => {
        if (song) player.togglePlayback();
        else onActivateHero();
    };

    return (
        <section id="tv-layer-car-console" className="tv-car-console" aria-label={t('tv.car.title')}>
            <header className="tv-car-console-heading">
                <span className="tv-car-console-mark" aria-hidden="true"><Car size={24} /></span>
                <span>
                    <strong>{t('tv.car.title')}</strong>
                    <small>{t('tv.car.subtitle')}</small>
                </span>
            </header>
            <div className="tv-car-console-body">
                <button
                    type="button"
                    className="tv-car-now-playing"
                    data-tv-focusable="true"
                    data-tv-focus-key="car-open-player"
                    onClick={onOpenPlayer}
                >
                    <span className="tv-car-art">
                        {coverUrl
                            ? <img src={coverUrl} alt="" loading="eager" decoding="async" />
                            : <Music2 size={34} />}
                    </span>
                    <span className="tv-car-now-copy">
                        <small>{t('tv.car.nowPlaying')}</small>
                        <strong>{song?.name || t('tv.car.noSong')}</strong>
                        <span>{song ? getSongArtistLabel(song) : t('tv.car.noSongHint')}</span>
                    </span>
                </button>
                <div className="tv-car-transport">
                    <button
                        type="button"
                        data-tv-focusable="true"
                        data-tv-focus-key="car-previous"
                        onClick={player.previous}
                        aria-label={t('tv.player.previous')}
                    >
                        <SkipBack size={28} fill="currentColor" />
                    </button>
                    <button
                        type="button"
                        className="is-primary"
                        data-tv-focusable="true"
                        data-tv-focus-key="car-play"
                        onClick={togglePlayback}
                        aria-label={transportLabel}
                    >
                        {isPlaying
                            ? <Pause size={34} fill="currentColor" />
                            : <Play size={34} fill="currentColor" />}
                    </button>
                    <button
                        type="button"
                        data-tv-focusable="true"
                        data-tv-focus-key="car-next"
                        onClick={player.next}
                        aria-label={t('tv.player.next')}
                    >
                        <SkipForward size={28} fill="currentColor" />
                    </button>
                </div>
                <div
                    className="tv-car-actions"
                    data-tv-focus-group="car-library-actions"
                    data-tv-focus-axis="horizontal"
                >
                    <button
                        type="button"
                        className="tv-car-action"
                        data-tv-focusable="true"
                        data-tv-focus-key="car-scan"
                        aria-disabled={actions.busy !== null}
                        onClick={() => void actions.scanDeviceMusic()}
                    >
                        <RefreshCw size={21} />
                        <span>{actions.busy === 'scan' ? t('tv.car.scanning') : t('tv.car.scan')}</span>
                    </button>
                    <button
                        type="button"
                        className="tv-car-action"
                        data-tv-focusable="true"
                        data-tv-focus-key="car-import"
                        aria-disabled={actions.busy !== null}
                        onClick={() => void actions.importMusic()}
                    >
                        <FolderOpen size={21} />
                        <span>{actions.busy === 'import' ? t('tv.car.importing') : t('tv.car.import')}</span>
                    </button>
                    <button
                        type="button"
                        className="tv-car-action"
                        data-tv-focusable="true"
                        data-tv-focus-key="car-default-player"
                        aria-disabled={actions.busy !== null}
                        onClick={() => void actions.openDefaultPlayerSettings()}
                    >
                        <BadgeCheck size={21} />
                        <span>
                            {actions.busy === 'default-player'
                                ? t('tv.car.openingSettings')
                                : t('tv.car.defaultPlayer')}
                        </span>
                    </button>
                </div>
            </div>
            <footer className="tv-car-console-footer">
                <span className="tv-car-hints">
                    <span className="tv-car-default-hint">{t('tv.car.defaultHint')}</span>
                    <span className="tv-car-voice-hint">{t('tv.car.voiceHint')}</span>
                </span>
                <span className="tv-car-action-status" aria-live="polite">
                    {actionMessage ?? (player.status === 'loading' ? t('tv.car.preparing') : '')}
                </span>
            </footer>
        </section>
    );
};
