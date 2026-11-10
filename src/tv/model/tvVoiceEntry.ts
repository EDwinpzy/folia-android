// src/tv/model/tvVoiceEntry.ts

export type TvVoiceNamedItem = {
    name: string;
};

const normalize = (value: string): string => (
    value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '')
);

/**
 * Resolves a spoken playlist, album or radio name against the cards already shown on TV home.
 * Exact names win; otherwise a unique prefix or substring is accepted.
 */
export const selectTvVoiceNamedItem = <T extends TvVoiceNamedItem>(
    items: readonly T[],
    query: string | null | undefined,
): T | null => {
    const normalizedQuery = normalize(query ?? '');
    if (!normalizedQuery) return null;

    const uniqueMatch = (predicate: (item: T) => boolean): T | null => {
        const matches = items.filter(predicate);
        return matches.length === 1 ? matches[0] : null;
    };

    const exact = uniqueMatch(item => normalize(item.name) === normalizedQuery);
    if (exact) return exact;

    const prefix = uniqueMatch(item => normalize(item.name).startsWith(normalizedQuery));
    if (prefix) return prefix;

    return uniqueMatch(item => normalize(item.name).includes(normalizedQuery));
};
