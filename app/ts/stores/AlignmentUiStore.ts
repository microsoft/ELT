// UI states for alignment.

import { AlignedTimeSeries, AlignmentState, Marker, MarkerCorrespondence, Track } from '../stores/dataStructures/alignment';
import { LayoutParameters } from '../stores/dataStructures/LayoutParameters';
import { alignmentLabelingStore, alignmentLabelingUiStore, alignmentStore } from './stores';
import * as d3 from 'd3';
import { action, observable, ObservableMap } from 'mobx';


// TrackLayout: stores where a track should be displayed.
export interface TrackLayout {
    track: Track;
    y0: number;
    y1: number;
    height: number;
}



export class AlignmentUiStore {

    // TODO: TrackLayout logic should be moved to the view class? Animation could happen when tracks get added/removed.
    @observable private _trackLayout: ObservableMap<TrackLayout>;

    // Individually stores current time cursor for timeSeries.
    // The timeCursors should be in the series's own timestamps.
    @observable private _seriesTimeCursor: ObservableMap<number>;

    @observable private _alignmentState: ObservableMap<AlignmentState>;

    // Currently selected markers OR correspondence (update one should cause the other to be null).
    @observable public selectedMarker: Marker;
    @observable public selectedCorrespondence: MarkerCorrespondence;

    constructor() {
        this._seriesTimeCursor = observable.map<number>();
        this._alignmentState = observable.map<AlignmentState>();
        this.selectedMarker = null;
        this.selectedCorrespondence = null;

        this.getTimeCursor = this.getTimeCursor.bind(this);

        this.computeTrackLayout();

        // No addListener for onTracksChanged. 
        //   alignmentStore is responsible to update the UI store when tracks changed,
        //   this is to prevent event ordering issues. 

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
            const currentState = this._alignmentState.get(series.id.toString());
            if (currentState) {
                if (rangeStart !== null) {
                    currentState.rangeStart = rangeStart;
                }
                if (pixelsPerSecond !== null) {
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
        this.computeTrackLayout();
    }

    public onTracksChanged(): void {
        for (const track of alignmentLabelingStore.tracks) {
            for (const series of track.alignedTimeSeries) {
                if (!this._alignmentState.has(series.id.toString())) {
                    this._alignmentState.set(series.id.toString(), {
                        rangeStart: series.referenceStart,
                        pixelsPerSecond: alignmentLabelingUiStore.viewWidth / (series.referenceEnd - series.referenceStart)
                    });
                }
            }
        }
        this.computeTrackLayout();
    }

    private computeTrackLayout(): void {
        this._trackLayout = observable.map<TrackLayout>();

        const smallOffset = 0;
        const axisOffset = 22;
        let trackYCurrent = LayoutParameters.alignmentTrackYOffset;
        const trackHeight = LayoutParameters.alignmentTrackHeight;
        const trackMinimizedHeight = LayoutParameters.alignmentTrackMinimizedHeight;
        const trackGap = LayoutParameters.alignmentTrackGap;
        if (alignmentLabelingStore.referenceTrack) {
            const track = alignmentLabelingStore.referenceTrack;
            this._trackLayout.set(track.id.toString(), {
                track: track,
                y0: axisOffset + smallOffset - LayoutParameters.referenceDetailedViewHeightAlignment,
                y1: axisOffset + smallOffset,
                height: LayoutParameters.referenceDetailedViewHeightAlignment
            });
        }
        alignmentLabelingStore.tracks.forEach((track) => {
            const trackY = trackYCurrent;
            const height = track.minimized ? trackMinimizedHeight : trackHeight;
            this._trackLayout.set(track.id.toString(), {
                track: track,
                y0: trackY,
                y1: trackY + height,
                height: height
            });
            trackYCurrent += height + trackGap;
        });
    }

    public getTimeCursor(series: AlignedTimeSeries): number {
        return this._seriesTimeCursor.get(series.id.toString());
    }

    public getTrackLayout(track: Track): TrackLayout {
        return this._trackLayout.get(track.id.toString());
    }

    public getAlignmentState(timeSeries: AlignedTimeSeries): AlignmentState {
        return this._alignmentState.get(timeSeries.id.toString());
    }

    @action
    public setAlignmentState(timeSeries: AlignedTimeSeries, state: AlignmentState): void {
        this._alignmentState.set(timeSeries.id.toString(), state);
        // this.emitSeriesTimeCursorChanged();
    }

}
