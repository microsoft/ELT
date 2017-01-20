// UI states for alignment.

import { AlignedTimeSeries, AlignmentParameters, Marker, MarkerCorrespondence, Track } from '../stores/dataStructures/alignment';
import { alignmentLabelingUiStore, alignmentStore } from './stores';
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

    @action
    public setReferenceViewTimeCursor(timeCursor: number): void {
        const blocks = alignmentStore.getAlignedBlocks();
        blocks.forEach((block) => {
            if (alignmentStore.isBlockAligned(block)) {
                block.forEach((series) => {
                    const scale = d3.scaleLinear()
                        .domain([series.referenceStart, series.referenceEnd])
                        .range([series.timeSeries[0].timestampStart, series.timeSeries[0].timestampEnd]);
                    this._seriesTimeCursor.set(series.id.toString(), scale(timeCursor));
                });
            }
        });
    }

    @action
    public setSeriesTimeCursor(series: AlignedTimeSeries, timeCursor: number): void {
        this._seriesTimeCursor.set(series.id.toString(), timeCursor);
    }

    @action
    public setTimeSeriesZooming(alignedSeries: AlignedTimeSeries, rangeStart?: number, pixelsPerSecond?: number): void {
        const block = alignmentStore.getConnectedSeries(alignedSeries);
        block.forEach(series => {
            const currentState = this._alignmentParameterMap.get(series.id.toString());
            if (currentState) {
                if (rangeStart) {
                    currentState.rangeStart = rangeStart;
                }
                if (pixelsPerSecond) {
                    currentState.pixelsPerSecond = pixelsPerSecond;
                }
            }
        });
    }

    @action
    public selectMarker(marker: Marker): void {
        this.selectedMarker = marker;
        this.selectedCorrespondence = null;
    }

    @action
    public selectMarkerCorrespondence(correspondence: MarkerCorrespondence): void {
        this.selectedCorrespondence = correspondence;
        this.selectedMarker = null;
    }

    @action
    public setTrackMinimized(track: Track, minimized: boolean): void {
        track.minimized = minimized;
    }

    public getTimeCursor(series: AlignedTimeSeries): number {
        return this._seriesTimeCursor.get(series.id.toString());
    }

    public getAlignmentParameters(timeSeries: AlignedTimeSeries): AlignmentParameters {
        const id = timeSeries.id.toString();
        if (!this._alignmentParameterMap.has(id)) {
            this.setAlignmentParameters(timeSeries, {
                rangeStart: timeSeries.referenceStart,
                pixelsPerSecond: alignmentLabelingUiStore.viewWidth / timeSeries.duration
            });
        }
        return this._alignmentParameterMap.get(timeSeries.id.toString());
    }

    @action
    public setAlignmentParameters(timeSeries: AlignedTimeSeries, state: AlignmentParameters): void {
        this._alignmentParameterMap.set(timeSeries.id.toString(), state);
    }

}
