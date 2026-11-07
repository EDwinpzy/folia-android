package top.izuna.foliamajor;

import android.media.AudioManager;
import android.os.Bundle;

/**
 * Automotive entry point. It shares the TV WebView, focus and playback-safe window behavior while
 * loading the car-specific renderer and routing hardware volume keys to media playback.
 */
public class CarActivity extends TvActivity {
    @Override
    protected String getStartPath() {
        return "/car.html";
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setVolumeControlStream(AudioManager.STREAM_MUSIC);
    }
}
