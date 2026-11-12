package top.izuna.foliamajor;

import android.app.SearchManager;
import android.content.Intent;
import android.provider.MediaStore;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/** Standard and app-specific media-search intents accepted from voice assistants and helpers. */
final class VoicePlayIntents {
    static final String ACTION_VOICE_PLAY = "top.izuna.foliamajor.action.VOICE_PLAY";
    static final String ACTION_VOICE_COMMAND_V1 =
        "top.izuna.foliamajor.action.VOICE_COMMAND_V1";
    static final String EXTRA_QUERY = "query";
    static final String EXTRA_OPERATION = "operation";
    static final String EXTRA_ENTRY = "entry";
    static final String OPERATION_PLAY_ENTRY = "PLAY_ENTRY";
    private static final int MAX_QUERY_LENGTH = 80;
    private static final Set<String> MUSIC_ENTRIES = new HashSet<>(Arrays.asList(
        "music.resume",
        "music.liked",
        "music.personal_fm",
        "music.daily_recommendations",
        "music.local",
        "music.recent",
        "music.cloud",
        "music.playlist",
        "music.album",
        "music.radio"
    ));
    private static final Set<String> NAMED_MUSIC_ENTRIES = new HashSet<>(Arrays.asList(
        "music.playlist",
        "music.album",
        "music.radio"
    ));

    static final class Request {
        final String query;
        final String entry;

        private Request(String query, String entry) {
            this.query = query;
            this.entry = entry;
        }

        static Request query(String query) {
            return new Request(query, null);
        }

        static Request entry(String entry, String query) {
            return new Request(query, entry);
        }
    }

    static Request readRequest(Intent intent) {
        if (intent == null) return null;
        String action = intent.getAction();
        if (ACTION_VOICE_COMMAND_V1.equals(action)) {
            String operation = normalizeOperation(intent.getStringExtra(EXTRA_OPERATION));
            if (!OPERATION_PLAY_ENTRY.equals(operation)) return null;
            String entry = normalizeEntry(intent.getStringExtra(EXTRA_ENTRY));
            if (entry == null) return null;
            String query = normalize(intent.getStringExtra(EXTRA_QUERY));
            if (NAMED_MUSIC_ENTRIES.contains(entry) && query == null) return null;
            return Request.entry(entry, query);
        }
        if (ACTION_VOICE_PLAY.equals(action)) {
            return Request.query(normalize(intent.getStringExtra(EXTRA_QUERY)));
        }
        if (MediaStore.INTENT_ACTION_MEDIA_PLAY_FROM_SEARCH.equals(action)
            || MediaStore.INTENT_ACTION_MEDIA_SEARCH.equals(action)) {
            String query = intent.getStringExtra(SearchManager.QUERY);
            if (query == null) query = intent.getStringExtra(Intent.EXTRA_TEXT);
            return Request.query(normalize(query));
        }
        return null;
    }

    static String normalizeEntry(String entry) {
        if (entry == null) return null;
        String normalized = entry.trim().toLowerCase(java.util.Locale.ROOT);
        return MUSIC_ENTRIES.contains(normalized) ? normalized : null;
    }

    static String normalizeOperation(String operation) {
        if (operation == null) return null;
        String normalized = operation.trim().toUpperCase(java.util.Locale.ROOT);
        return OPERATION_PLAY_ENTRY.equals(normalized) ? normalized : null;
    }

    static String normalize(String query) {
        if (query == null) return null;
        String normalized = query.trim();
        if (normalized.isEmpty()) return null;
        return normalized.length() > MAX_QUERY_LENGTH
            ? normalized.substring(0, MAX_QUERY_LENGTH)
            : normalized;
    }

    static void clear(Intent intent) {
        if (intent == null) return;
        intent.removeExtra(EXTRA_QUERY);
        intent.removeExtra(EXTRA_OPERATION);
        intent.removeExtra(EXTRA_ENTRY);
        intent.removeExtra(SearchManager.QUERY);
        intent.removeExtra(Intent.EXTRA_TEXT);
    }

    private VoicePlayIntents() {}
}
