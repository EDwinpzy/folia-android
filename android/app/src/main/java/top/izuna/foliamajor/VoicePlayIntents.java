package top.izuna.foliamajor;

import android.content.Intent;

/** Contract shared with the voice helper for an explicit song request. */
final class VoicePlayIntents {
    static final String ACTION_VOICE_PLAY = "top.izuna.foliamajor.action.VOICE_PLAY";
    static final String EXTRA_QUERY = "query";
    private static final int MAX_QUERY_LENGTH = 80;

    static String readQuery(Intent intent) {
        if (intent == null || !ACTION_VOICE_PLAY.equals(intent.getAction())) return null;
        return normalize(intent.getStringExtra(EXTRA_QUERY));
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
        if (intent != null) intent.removeExtra(EXTRA_QUERY);
    }

    private VoicePlayIntents() {}
}
