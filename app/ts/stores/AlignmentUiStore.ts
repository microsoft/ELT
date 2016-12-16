// UI states for alignment.

import * as Actions from '../actions/Actions';
import {AlignedTimeSeries, AlignmentState, LayoutParameters, Marker, MarkerCorrespondence, Track } from '../common/common';
import {globalDispatcher} from '../dispatcher/globalDispatcher';
import {NodeEvent} from './NodeEvent';
import {alignmentLabelingStore, alignmentLabelingUiStore, alignmentStore} from './stores';
import * as d3 from 'd3';
import {EventEmitter} from 'events';




// TrackLayout: stores where a track should be displayed.
export interface TrackLayout {
    track: Track;
    y0: number;
    y1: number;
    height: number;
}

export class AlignmentUiStore extends EventEmitter {

    // Tracks layout information.
    // TODO: TrackLayout logic should be moved to the view class? Animation could happen when tracks get added/removed.
    private _trackLayout: WeakMap<Track, TrackLayout>;

    // Individually stores current time cursor for timeSeries.
    // The timeCursors should be in the series's own timestamps.
    private _seriesTimeCursor: WeakMap<AlignedTimeSeries, number>;

    // Current alignment states.
    private _alignmentState: WeakMap<AlignedTimeSeries, AlignmentState>;

    // Currently selected markers OR correspondence (update one should cause the other to be null).
    private _selectedMarker: Marker;
    private _selectedCorrespondence: MarkerCorrespondence;

    public get selectedMarker(): Marker { return this._selectedMarker; }
    public get selectedCorrespondence(): MarkerCorrespondence { return this._selectedCorrespondence; }
    public set selectedMarker(marker: Marker) {
        this._selectedMarker = marker;
        this._selectedCorrespondence = null;
        this.selectionChanged.emit();
    }
    public set selectedCorrespondence(c: MarkerCorrespondence) {
        this._selectedMarker = null;
        this._selectedCorrespondence = c;
        this.selectionChanged.emit();
    }

    constructor() {
        super();

        this._seriesTimeCursor = new WeakMap<AlignedTimeSeries, number>();
        this._alignmentState = new WeakMap<AlignedTimeSeries, AlignmentState>();
        this._selectedMarker = null;
        this._selectedCorrespondence = null;

        this.getTimeCursor = this.getTimeCursor.bind(this);

        this.computeTrackLayout();

        // No addListener for onTracksChanged. 
        //   alignmentStore is responsible to update the UI store when tracks changed,
        //   this is to prevent event ordering issues. 

        globalDispatcher.register(action => {
            // UIAction.
            if (action instanceof Actions.CommonActions.UIAction) {
                this.handleUiAction(action);
            }
        });
    }

    public handleUiAction(action: Actions.CommonActions.UIAction): void {
        // SetReferenceViewTimeCursor
        if (action instanceof Actions.CommonActions.SetReferenceViewTimeCursor) {
            const blocks = alignmentStore.getAlignedBlocks();
            blocks.forEach((block) => {
                if (alignmentStore.isBlockAligned(block)) {
                    block.forEach((series) => {
                        const scale = d3.scaleLinear()
                            .domain([series.referenceStart, series.referenceEnd])
                            .range([series.timeSeries[0].timestampStart, series.timeSeries[0].timestampEnd]);
                        this._seriesTimeCursor.set(series, scale(action.timeCursor));
                    });
                }
            });
            this.seriesTimeCursorChanged.emit();
        }
        // SetSeriesTimeCursor
        if (action instanceof Actions.AlignmentActions.SetSeriesTimeCursor) {
            this._seriesTimeCursor.set(action.series, action.timeCursor);
            this.seriesTimeCursorChanged.emit();
        }
        // SetTimeSeriesZooming
        if (action instanceof Actions.AlignmentActions.SetTimeSeriesZooming) {
            const block = alignmentStore.getConnectedSeries(action.series);
            block.forEach((series) => {
                const currentState = this._alignmentState.get(series);
                if (currentState) {
                    if (action.rangeStart !== null) {
                        currentState.rangeStart = action.rangeStart;
                    }
                    if (action.pixelsPerSecond !== null) {
                        currentState.pixelsPerSecond = action.pixelsPerSecond;
                    }
                }
            });
            this.seriesTimeCursorChanged.emit();
        }
        // SelectMarker
        if (action instanceof Actions.AlignmentActions.SelectMarker) {
            this._selectedMarker = action.marker;
            this._selectedCorrespondence = null;
            this.selectionChanged.emit();
        }
        // SelectMarkerCorrespondence
        if (action instanceof Actions.AlignmentActions.SelectMarkerCorrespondence) {
            this._selectedCorrespondence = action.correspondence;
            this._selectedMarker = null;
            this.selectionChanged.emit();
        }
        if (action instanceof Actions.AlignmentActions.SetTrackMinimized) {
            action.track.minimized = action.minimized;
            this.computeTrackLayout();
            this.tracksLayoutChanged.emit();
        }
    }

    public onTracksChanged(): void {
        for (const track of alignmentLabelingStore.tracks) {
            for (const series of track.alignedTimeSeries) {
                if (!this._alignmentState.has(series)) {
                    this._alignmentState.set(series, {
                        rangeStart: series.referenceStart,
                        pixelsPerSecond: alignmentLabelingUiStore.viewWidth / (series.referenceEnd - series.referenceStart)
                    });
                }
            }
        }
        this.computeTrackLayout();
    }

    private computeTrackLayout(): void {
        this._trackLayout = new WeakMap<Track, TrackLayout>();

        const smallOffset = 0;
        const axisOffset = 22;
        let trackYCurrent = LayoutParameters.alignmentTrackYOffset;
        const trackHeight = LayoutParameters.alignmentTrackHeight;
        const trackMinimizedHeight = LayoutParameters.alignmentTrackMinimizedHeight;
        const trackGap = LayoutParameters.alignmentTrackGap;
        if (alignmentLabelingStore.referenceTrack) {
            const track = alignmentLabelingStore.referenceTrack;
            this._trackLayout.set(track, {
                track: track,
                y0: axisOffset + smallOffset - LayoutParameters.referenceDetailedViewHeightAlignment,
                y1: axisOffset + smallOffset,
                height: LayoutParameters.referenceDetailedViewHeightAlignment
            });
        }
        alignmentLabelingStore.tracks.forEach((track) => {
            const trackY = trackYCurrent;
            const height = track.minimized ? trackMinimizedHeight : trackHeight;
            this._trackLayout.set(track, {
                track: track,
                y0: trackY,
                y1: trackY + height,
                height: height
            });
            trackYCurrent += height + trackGap;
        });
        this.tracksLayoutChanged.emit();
    }

    public getTimeCursor(series: AlignedTimeSeries): number {
        return this._seriesTimeCursor.get(series);
    }

    public getTrackLayout(track: Track): TrackLayout {
        return this._trackLayout.get(track);
    }

    public getAlignmentState(timeSeries: AlignedTimeSeries): AlignmentState {
        return this._alignmentState.get(timeSeries);
    }
    public setAlignmentState(timeSeries: AlignedTimeSeries, state: AlignmentState): void {
        this._alignmentState.set(timeSeries, state);
        // this.emitSeriesTimeCursorChanged();
    }

    public seriesTimeCursorChanged: NodeEvent = new NodeEvent(this, 'series-time-cursor-changed');

    public tracksLayoutChanged: NodeEvent = new NodeEvent(this, 'tracks-layout-changed');

    public selectionChanged: NodeEvent = new NodeEvent(this, 'selection-changed');
}
