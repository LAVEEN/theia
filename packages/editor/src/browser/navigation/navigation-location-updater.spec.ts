/*
 * Copyright (C) 2018 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { expect } from 'chai';
import { NavigationLocation } from './navigation-location';
import { NavigationLocationUpdater } from './navigation-location-updater';

// tslint:disable:no-unused-expression

const CURSOR = NavigationLocation.Type.CURSOR;
const CONTENT_CHANGE = NavigationLocation.Type.CONTENT_CHANGE;

describe('navigation-location-updater', () => {

    const updater = new NavigationLocationUpdater();

    it('should never affect a location if they belong to different resources', () => {
        const actual = updater.affects(
            NavigationLocation.create('file:///a', CURSOR, { line: 0, character: 0, }),
            NavigationLocation.create('file:///b', CURSOR, { line: 0, character: 0, })
        );
        expect(actual).to.be.false;
    });

    describe('Inserting or deleting text before the position shifts the position accordingly.', () => {

        it('should shift the position to left if deleting text before the location - different line', () => {
            const actual = updater.affects(
                NavigationLocation.create('file:///a', CURSOR, { line: 14, character: 16 }),
                NavigationLocation.create('file:///a', CONTENT_CHANGE, {
                    range: { start: { line: 8, character: 0 }, end: { line: 2, character: 38 } },
                    text: '',
                    rangeLength: -1 // This does not matter for the tests
                }),
            );
            expect(actual).to.be.deep.equal(NavigationLocation.create('file:///a', CURSOR, { line: 8, character: 16 }));
        });

        it('should shift the position to right if inserting text before the location - different line', () => {
            const actual = updater.affects(
                NavigationLocation.create('file:///a', CURSOR, { line: 14, character: 16 }),
                NavigationLocation.create('file:///a', CONTENT_CHANGE, {
                    range: { start: { line: 8, character: 0 }, end: { line: 2, character: 38 } },
                    text: 'Some added content that does not matter for the tests',
                    rangeLength: -1 // This does not matter for the tests
                }),
            );
            expect(actual).to.be.deep.equal(NavigationLocation.create('file:///a', CURSOR, { line: 20, character: 16 }));
        });

        it('should shift the position to left if deleting text before the location - same line', () => {
            const actual = updater.affects(
                NavigationLocation.create('file:///a', CURSOR, { line: 14, character: 16 }),
                NavigationLocation.create('file:///a', CONTENT_CHANGE, {
                    range: { start: { line: 14, character: 2 }, end: { line: 14, character: 6 } },
                    text: '',
                    rangeLength: -1 // This does not matter for the tests
                }),
            );
            expect(actual).to.be.deep.equal(NavigationLocation.create('file:///a', CURSOR, { line: 14, character: 12 }));
        });

        it('should shift the position to right if inserting text before the location - same line', () => {
            const actual = updater.affects(
                NavigationLocation.create('file:///a', CURSOR, { line: 14, character: 16 }),
                NavigationLocation.create('file:///a', CONTENT_CHANGE, {
                    range: { start: { line: 14, character: 2 }, end: { line: 14, character: 6 } },
                    text: 'Some added content that does not matter for the tests',
                    rangeLength: -1 // This does not matter for the tests
                }),
            );
            expect(actual).to.be.deep.equal(NavigationLocation.create('file:///a', CURSOR, { line: 14, character: 20 }));
        });

    });

    describe('Inserting text at the position offset shifts the position accordingly.', () => {

        it('should shift the position to right if inserting text at the offset of the location - different line', () => {
            const actual = updater.affects(
                NavigationLocation.create('file:///a', CURSOR, { line: 14, character: 16 }),
                NavigationLocation.create('file:///a', CONTENT_CHANGE, {
                    range: { start: { line: 2, character: 38 }, end: { line: 14, character: 16 } },
                    text: 'Some added content that does not matter for the tests',
                    rangeLength: -1 // This does not matter for the tests
                }),
            );
            expect(actual).to.be.deep.equal(NavigationLocation.create('file:///a', CURSOR, { line: 26, character: 16 }));
        });

        it('should shift the position to right if inserting text at the offset of the location - same line', () => {
            const actual = updater.affects(
                NavigationLocation.create('file:///a', CURSOR, { line: 14, character: 16 }),
                NavigationLocation.create('file:///a', CONTENT_CHANGE, {
                    range: { start: { line: 14, character: 5 }, end: { line: 14, character: 16 } },
                    text: 'Some added content that does not matter for the tests',
                    rangeLength: -1 // This does not matter for the tests
                }),
            );
            expect(actual).to.be.deep.equal(NavigationLocation.create('file:///a', CURSOR, { line: 14, character: 37 }));
        });

    });

});
