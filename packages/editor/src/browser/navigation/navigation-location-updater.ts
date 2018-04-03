/*
 * Copyright (C) 2018 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable } from 'inversify';
import { Position, Range, TextDocumentContentChangeDelta } from '../editor';
import { NavigationLocation, ContentChangeLocation, CursorLocation, SelectionLocation } from './navigation-location';

/**
 * A navigation location updater that is responsible for adapting editor navigation locations.
 *
 * - Inserting or deleting text before the position shifts the position accordingly.
 * - Inserting text at the position offset shifts the position accordingly.
 * - Inserting or deleting text strictly contained by the position shrinks or stretches the position.
 * - Inserting or deleting text after a position does not affect the position.
 * - Deleting text which strictly contains the position deletes the position.
 * Note that the position is not deleted if its only shrunken to length zero. To delete a position, the modification must delete from
 * strictly before to strictly after the position.
 * - Replacing text contained by the position shrinks or expands the position (but does not shift it), such that the final position
 * contains the original position and the replacing text.
 * - Replacing text overlapping the position in other ways is considered as a sequence of first deleting the replaced text and
 * afterwards inserting the new text. Thus, a position is shrunken and can then be shifted (if the replaced text overlaps the offset of the position).
 */
@injectable()
export class NavigationLocationUpdater {

    /**
     * Checks whether `candidate` has to be updated when applying `other`.
     *  - `false` if the `other` does not affect the `candidate`.
     *  - A `NavigationLocation` object if the `candidate` has to be replaced with the return value.
     *  - `undefined` if the candidate has to be deleted.
     *
     * If the `other` is not a `ContentChangeLocation` or it does not contain any actual content changes, this method returns with `false`
     */
    affects(candidate: NavigationLocation, other: NavigationLocation): false | NavigationLocation | undefined {
        if (!ContentChangeLocation.is(other)) {
            return false;
        }
        if (candidate.uri.toString() !== other.uri.toString()) {
            return false;
        }

        const candidateRange = NavigationLocation.range(candidate);
        const otherRange = NavigationLocation.range(other);
        if (candidateRange === undefined || otherRange === undefined) {
            return false;
        }

        const otherMaxLine = Math.max(otherRange.start.line, otherRange.end.line);
        const candidateMinLine = Math.min(candidateRange.start.line, candidateRange.end.line);
        // Inserting or deleting text before the position shifts the position accordingly.
        if (otherMaxLine < candidateMinLine) {
            const { uri, type } = candidate;
            const context = this.handleBefore(candidate, other.context);
            return {
                uri,
                type,
                context
            };
        }

        return false;
    }

    protected handleBefore(candidate: NavigationLocation, delta: TextDocumentContentChangeDelta): Position | Range | TextDocumentContentChangeDelta {
        const deletion = delta.text.length === 0;
        const lineDiff = Math.abs(delta.range.start.line - delta.range.end.line) * (deletion ? -1 : 1);
        if (CursorLocation.is(candidate)) {
            const { line, character } = candidate.context;
            return {
                line: line + lineDiff,
                character
            } as Position;
        }
        if (SelectionLocation.is(candidate)) {
            const { start, end } = candidate.context;
            return {
                start: {
                    line: start.line + lineDiff,
                    character: start.character
                },
                end: {
                    line: end.line + lineDiff,
                    character: end.character
                }
            };
        }
        if (ContentChangeLocation.is(candidate)) {
            const { range, rangeLength, text } = candidate.context;
            const { start, end } = range;
            return {
                range: {
                    start: {
                        line: start.line + lineDiff,
                        character: start.character
                    },
                    end: {
                        line: end.line + lineDiff,
                        character: end.character
                    }
                },
                rangeLength,
                text
            };
        }
        throw new Error(`Unexpected navigation location: ${candidate}.`);
    }

}
