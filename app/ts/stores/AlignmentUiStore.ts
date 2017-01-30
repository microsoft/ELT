// UI states for alignment.

import { Marker, MarkerCorrespondence, Track } from '../stores/dataStructures/alignment';
import {AlignmentStore} from './AlignmentStore';
import {ProjectUiStore} from './ProjectUiStore';
import { alignmentStore, projectStore, projectUiStore } from './stores';
import * as d3 from 'd3';
import { action, observable, ObservableMap, reaction } from 'mobx';



export class PanZoomParameters {
    // rangeStart and pixelsPerSecond in the timeSeries's time.
    public readonly rangeStart: number;
    public readonly pixelsPerSecond: number;
    // Only used when undo/redo.
    public referenceStart?: number;
    public referenceEnd?: number;
}



export class AlignmentUiStore {

    // Individually stores current time cursor for timeSeries.
    // The timeCursors should be in the series's own timestamps.
    @observable private _seriesTimeCursor: ObservableMap<number>;

    @observable private _panZoomParameterMap: ObservableMap<PanZoomParameters>;

    // Currently selected markers OR correspondence (update one should cause the other to be null).
    @observable public selectedMarker: Marker;
    @observable public selectedCorrespondence: MarkerCorrespondence;

    constructor(alignmentStore: AlignmentStore, projectUiStore: ProjectUiStore) {
        this._seriesTimeCursor = observable.map<number>();
        this._panZoomParameterMap = observable.map<PanZoomParameters>();
        this.selectedMarker = null;
        this.selectedCorrespondence = null;

        this.getTimeCursor = this.getTimeCursor.bind(this);

        reaction(
            () => observable([alignmentStore.trackBlocks, projectUiStore.referenceViewStart, projectUiStore.referenceViewEnd]),
            () => this.updatePanZoomBasedOnAlignment(),
            { name: 'AlignmentUiStore.updatePanZoomBasedOnAlignment' }
        );
    }

    @action public setReferenceViewTimeCursor(timeCursor: number): void {
        const blocks = alignmentStore.trackBlocks;
        blocks.forEach(block => {
            if (this.blockHasReferenceTrack(block)) {
                block.forEach(track => {
                    const scale = d3.scaleLinear()
                        .domain([track.referenceStart, track.referenceEnd])
                        .range([track.timeSeries[0].timestampStart, track.timeSeries[0].timestampEnd]);
                    this._seriesTimeCursor.set(track.id.toString(), scale(timeCursor));
                });
            }
        });
    }

    @action public setTimeCursor(track: Track, timeCursor: number): void {
        this._seriesTimeCursor.set(track.id.toString(), timeCursor);
    }

    public getTimeCursor(track: Track): number {
        return this._seriesTimeCursor.get(track.id.toString());
    }

    @action public selectMarker(marker: Marker): void {
        this.selectedMarker = marker;
        this.selectedCorrespondence = null;
    }

    @action public selectMarkerCorrespondence(correspondence: MarkerCorrespondence): void {
        this.selectedCorrespondence = correspondence;
        this.selectedMarker = null;
    }

    @action public setTrackMinimized(track: Track, minimized: boolean): void {
        track.minimized = minimized;
    }

    public getPanZoomParameters(track: Track): PanZoomParameters {
        if (projectStore.isReferenceTrack(track)) {
            return {
                rangeStart: projectUiStore.referenceViewStart,
                pixelsPerSecond: projectUiStore.referenceViewPPS
            };
        }
        if (!this._panZoomParameterMap.has(track.id)) {
            this.setPanZoomParameters(track, track.referenceStart, projectUiStore.viewWidth / track.duration);
        }
        return this._panZoomParameterMap.get(track.id);
    }

    @action public setPanZoomParameters(track: Track, rangeStart: number, pixelsPerSecond: number): void {
        if (!projectStore.isReferenceTrack(track)) {
            this._panZoomParameterMap.set(track.id.toString(), { rangeStart, pixelsPerSecond });
        }
    }

    @action public setBlockPanZoom(track: Track, rangeStart: number, pixelsPerSecond: number): void {
        const block = alignmentStore.getConnectedTracks(track);
        block.forEach(trackInBlock => {
            this._panZoomParameterMap.set(
                trackInBlock.id.toString(), { rangeStart, pixelsPerSecond });
        });
    }

    private blockHasReferenceTrack(block: Set<Track>): boolean {
        return block.has(projectStore.referenceTrack);
    }

    public updatePanZoomBasedOnAlignment(animate: boolean = false): void {
        // A "block" is a set of connected tracks.
        for (const block of alignmentStore.trackBlocks) {
            // If it's a reference track.
            if (this.blockHasReferenceTrack(block)) {
                block.forEach(track => {
                    track.isAlignedToReferenceTrack = true;
                    this.setPanZoomParameters(
                        track, projectUiStore.referenceViewStart, projectUiStore.referenceViewPPS);
                });
            } else {
                const ranges: [number, number][] = [];
                block.forEach(track => {
                    track.isAlignedToReferenceTrack = false;
                    const alignmentParms = this.getPanZoomParameters(track);
                    if (alignmentParms) {
                        ranges.push([alignmentParms.rangeStart, alignmentParms.pixelsPerSecond]);
                    }
                });
                block.forEach(track => {
                    this.setPanZoomParameters(
                        track, d3.mean(ranges, x => x[0]), 1 / d3.mean(ranges, x => 1 / x[1]));
                });
            }
        }
    }

}
