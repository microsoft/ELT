// UI states for alignment.

import { AlignmentParameters, Marker, MarkerCorrespondence, Track } from '../stores/dataStructures/alignment';
import { alignmentStore, projectStore, projectUiStore } from './stores';
import * as d3 from 'd3';
import { action, observable, ObservableMap } from 'mobx';



export class AlignmentUiStore {

    // Individually stores current time cursor for timeSeries.
    // The timeCursors should be in the series's own timestamps.
    @observable private _seriesTimeCursor: ObservableMap<number>;

    @observable private _alignmentParameterMap: ObservableMap<AlignmentParameters>;

    // Currently selected markers OR correspondence (update one should cause the other to be null).
    @observable public selectedMarker: Marker;
    @observable public selectedCorrespondence: MarkerCorrespondence;

    constructor() {
        this._seriesTimeCursor = observable.map<number>();
        this._alignmentParameterMap = observable.map<AlignmentParameters>();
        this.selectedMarker = null;
        this.selectedCorrespondence = null;

        this.getTimeCursor = this.getTimeCursor.bind(this);
    }

    @action public setReferenceViewTimeCursor(timeCursor: number): void {
        const blocks = alignmentStore.getAlignedBlocks();
        blocks.forEach(block => {
            if (alignmentStore.isBlockAligned(block)) {
                block.forEach(series => {
                    const scale = d3.scaleLinear()
                        .domain([series.referenceStart, series.referenceEnd])
                        .range([series.timeSeries[0].timestampStart, series.timeSeries[0].timestampEnd]);
                    this._seriesTimeCursor.set(series.id.toString(), scale(timeCursor));
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

    @action public setTimeSeriesZooming(track: Track, rangeStart?: number, pixelsPerSecond?: number): void {
        const block = alignmentStore.getConnectedSeries(track);
        block.forEach(series => {
            const currentState = this._alignmentParameterMap.get(series.id.toString());
            if (currentState) {
                this._alignmentParameterMap.set(
                    series.id.toString(),
                    {
                        rangeStart: rangeStart || currentState.rangeStart,
                        pixelsPerSecond: pixelsPerSecond || currentState.pixelsPerSecond
                    });
            }
        });
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

    public getAlignmentParameters(track: Track): AlignmentParameters {
        if (track.id === projectStore.referenceTrack.id) {
            return {
                rangeStart: projectUiStore.referenceViewStart,
                pixelsPerSecond: projectUiStore.referenceViewPPS
            };
        }
        if (!this._alignmentParameterMap.has(track.id)) {
            this.setAlignmentParameters(track, {
                rangeStart: track.referenceStart,
                pixelsPerSecond: projectUiStore.viewWidth / track.duration
            });
        }
        return this._alignmentParameterMap.get(track.id);
    }

    @action public setAlignmentParameters(track: Track, state: AlignmentParameters): void {
        if (track.id !== projectStore.referenceTrack.id) {
            this._alignmentParameterMap.set(track.id.toString(), state);
        }
    }

}
