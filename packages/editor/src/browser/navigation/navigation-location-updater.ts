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
     * Checks whether `candidateLocation` has to be updated when applying `other`.
     *  - `false` if the `other` does not affect the `candidateLocation`.
     *  - A `NavigationLocation` object if the `candidateLocation` has to be replaced with the return value.
     *  - `undefined` if the candidate has to be deleted.
     *
     * If the `otherLocation` is not a `ContentChangeLocation` or it does not contain any actual content changes, this method returns with `false`
     */
    affects(candidateLocation: NavigationLocation, otherLocation: NavigationLocation): false | NavigationLocation | undefined {
        if (!ContentChangeLocation.is(otherLocation)) {
            return false;
        }
        if (candidateLocation.uri.toString() !== otherLocation.uri.toString()) {
            return false;
        }

        const candidate = NavigationLocation.range(candidateLocation);
        const other = NavigationLocation.range(otherLocation);
        if (candidate === undefined || other === undefined) {
            return false;
        }

        const otherMaxLine = Math.max(other.start.line, other.end.line);
        const candidateMinLine = Math.min(candidate.start.line, candidate.end.line);
        const candidateMinCharacter = Math.min(candidate.start.character, candidate.end.character);
        const lineDiff = Math.abs(other.start.line - other.end.line);
        // If the max line of the modification is less than the candidate min line, no need to shift the characters.
        // If the max line of the modification equals with the min line of candidate, we need to consider the characters.
        // Otherwise, the modification is after the candidate, and we can ignore those cases.

        let characterDiff = NaN;
        if (otherMaxLine === candidateMinLine || otherMaxLine < candidateMinLine) {
            if (otherMaxLine === candidateMinLine) {
                if (other.start.line === otherMaxLine && other.start.character <= candidateMinCharacter) {
                    characterDiff = candidateMinCharacter - other.start.character;
                } else if (other.end.character <= candidateMinCharacter) {
                    characterDiff = candidateMinCharacter - other.end.character;
                }
            }
            const { uri, type } = candidateLocation;
            const context = this.handleBefore(candidateLocation, other, lineDiff, characterDiff, otherLocation.context.text === '');
            return {
                uri,
                type,
                context
            };
        }

        return false;
    }

    protected handleBefore(
        candidate: NavigationLocation,
        modification: Range,
        lineDiff: number,
        characterDiff: number,
        deletion: boolean): Position | Range | TextDocumentContentChangeDelta {

        let range = NavigationLocation.range(candidate);
        range = this.shiftLine(range, deletion ? lineDiff * -1 : lineDiff);
        range = this.shiftCharacter(range, deletion ? characterDiff * -1 : characterDiff);

        if (CursorLocation.is(candidate)) {
            return range.start;
        }
        if (SelectionLocation.is(candidate)) {
            return range;
        }
        if (ContentChangeLocation.is(candidate)) {
            const { rangeLength, text } = candidate.context;
            return {
                range,
                rangeLength,
                text
            };
        }
        throw new Error(`Unexpected navigation location: ${candidate}.`);
    }

    protected shiftLine(position: Position, diff: number): Position;
    protected shiftLine(range: Range, diff: number): Range;
    protected shiftLine(input: Position | Range, diff: number): Position | Range {
        if (Number.isNaN(diff)) {
            return input;
        }
        if (Position.is(input)) {
            const { line, character } = input;
            return {
                line: line + diff,
                character
            };
        }
        const { start, end } = input;
        return {
            start: this.shiftLine(start, diff),
            end: this.shiftLine(end, diff)
        };
    }

    protected shiftCharacter(position: Position, diff: number): Position;
    protected shiftCharacter(range: Range, diff: number): Range;
    protected shiftCharacter(input: Position | Range, diff: number): Position | Range {
        if (Number.isNaN(diff)) {
            return input;
        }
        if (Position.is(input)) {
            const { line, character } = input;
            return {
                line,
                character: character + diff
            };
        }
        const { start, end } = input;
        return {
            start: this.shiftCharacter(start, diff),
            end: this.shiftCharacter(end, diff)
        };
    }

}
