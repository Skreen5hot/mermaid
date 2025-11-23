/**
 * @module diff3
 * @description Provides a simple 3-way line-based text merge utility.
 * For safety, this basic implementation defaults to a conflicted state.
 */

/**
 * Performs a 3-way merge of text content.
 *
 * A true, robust 3-way merge is a complex algorithm. This function provides
 * the structure for such a merge but defaults to a "conflicted" state by
 * creating a standard conflict-marker block. This is the safest default
 * behavior, ensuring no data is lost if an automatic merge is not clearly possible.
 *
 * In the future, a more sophisticated line-based diffing algorithm (like Longest
 * Common Subsequence) could be implemented here to handle simple additive changes
 * automatically.
 *
 * @param {string} baseContent - The common ancestor content.
 * @param {string} localContent - The local (my) version.
 * @param {string} remoteContent - The remote (their) version.
 * @returns {{clean: boolean, mergedContent: string}} An object indicating if the merge was clean and the resulting content.
 */
export function merge3Way(baseContent, localContent, remoteContent) {
    // A simple heuristic: if the local content is the same as the base,
    // then only the remote has changed. We can safely take the remote version.
    if (baseContent === localContent) {
        return {
            clean: true,
            mergedContent: remoteContent
        };
    }

    // Another simple heuristic: if the remote content is the same as the base,
    // then only the local has changed. We can safely take the local version.
    if (baseContent === remoteContent) {
        return {
            clean: true,
            mergedContent: localContent
        };
    }

    // If both have changed from the base, it's a conflict.
    // Default to creating a conflict-marker block for manual resolution.
    // This is the safest fallback.
    return {
        clean: false,
        mergedContent: `<<<<<<< LOCAL\n${localContent}\n=======\n${remoteContent}\n>>>>>>> REMOTE`
    };
}