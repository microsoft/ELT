// AlignmentStore
// Store alignment markers and correspondences (connections between markers).

import * as Actions from '../actions/Actions';
import {AlignedTimeSeries, Marker, MarkerCorrespondence, SavedAlignmentState,
    SavedMarker, SavedMarkerCorrespondence, TransitionController} from '../common/common';
import {globalDispatcher} from '../dispatcher/globalDispatcher';
import {AlignmentLabelingStore} from './AlignmentLabelingStore';
import {AlignmentLabelingUiStore} from './AlignmentLabelingUiStore';
import {NodeEvent} from './NodeEvent';
import {alignmentLabelingStore, alignmentLabelingUiStore, alignmentUiStore} from './stores';
import * as d3 from 'd3';
import {EventEmitter} from 'events';



// Take a snapshot from the alignmentStore, isolate all current rendering parametes.
interface TimeSeriesStateSnapshotInfo {
    referenceStart: number;
    referenceEnd: number;
    rangeStart: number;
    pixelsPerSecond: number;
}

export class TimeSeriesStateSnapshot {
    private data: Map<string, TimeSeriesStateSnapshotInfo>;
    private alignmentStore: AlignmentStore;

    constructor(alignmentStore: AlignmentStore) {
        this.alignmentStore = alignmentStore;
        this.data = new Map<string, TimeSeriesStateSnapshotInfo>();
        // Take the snapshot.
        alignmentLabelingStore.tracks.forEach((track) => {
            track.alignedTimeSeries.forEach((timeSeries) => {
                const state = alignmentUiStore.getAlignmentState(timeSeries);
                this.data.set(timeSeries.id, {
                    referenceStart: timeSeries.referenceStart,
                    referenceEnd: timeSeries.referenceEnd,
                    rangeStart: state !== null ? state.rangeStart : null,
                    pixelsPerSecond: state !== null ? state.pixelsPerSecond : null
                });
            });
        });
    }

    public toObject(): { [name: string]: TimeSeriesStateSnapshotInfo } {
        const result: { [name: string]: TimeSeriesStateSnapshotInfo } = {};
        this.data.forEach((info, seriesID) => {
            result[seriesID] = info;
        });
        return result;
    }

    // Apply the snapshot to the store.
    public apply(): void {
        this.data.forEach((info, seriesID) => {
            const series = alignmentLabelingStore.getTimeSeriesByID(seriesID);
            if (!series) { return; }
            series.referenceStart = info.referenceStart;
            series.referenceEnd = info.referenceEnd;
            const state = alignmentUiStore.getAlignmentState(series);
            if (state) {
                state.rangeStart = info.rangeStart;
                state.pixelsPerSecond = info.pixelsPerSecond;
            }
        });
    }

    // Apply the interpolation between two snapshots to the store.
    public applyInterpolate(s2: TimeSeriesStateSnapshot, t: number): void {
        const mix = (a: number, b: number) => {
            if (a === null || b === null) { return null; }
            return a * (1 - t) + b * t;
        };
        const mixINV = (a: number, b: number) => {
            if (a === null || b === null) { return null; }
            return 1 / ((1 / a) * (1 - t) + (1 / b) * t);
        };
        this.data.forEach((info, seriesID) => {
            const series = alignmentLabelingStore.getTimeSeriesByID(seriesID);
            if (!series) { return; }
            const info2 = s2.data.get(seriesID);
            series.referenceStart = mix(info.referenceStart, info2.referenceStart);
            series.referenceEnd = mix(info.referenceEnd, info2.referenceEnd);
            const state = alignmentUiStore.getAlignmentState(series);
            if (state) {
                state.rangeStart = mix(info.rangeStart, info2.rangeStart);
                state.pixelsPerSecond = mixINV(info.pixelsPerSecond, info2.pixelsPerSecond);
            }
        });
    }
}

// AlignmentStore
// Store alignment markers and correspondences (connections between markers).
export class AlignmentStore extends EventEmitter {

    // Markers.
    private _markers: Marker[];

    // Correspondences between markers.
    private _correspondences: MarkerCorrespondence[];

    // Manages alignment transitions:
    // TODO: move the transition handling to the view, handle transition for track add/remove.
    private _alignmentTransitionController: TransitionController;

    constructor(alignmentLabelingStore: AlignmentLabelingStore, alignmentLabelingUiStore: AlignmentLabelingUiStore) {
        super();

        this._markers = [];
        this._correspondences = [];
        this._alignmentTransitionController = null;

        alignmentLabelingStore.tracksChanged.on(this.onTracksChanged.bind(this));
        alignmentLabelingUiStore.referenceViewChanged.on(this.rearrangeSeries.bind(this));

        globalDispatcher.register(action => {
            if (action instanceof Actions.AlignmentActions.AddMarker) {
                alignmentLabelingStore.alignmentHistoryRecord();
                this._markers.push(action.marker);
                alignmentUiStore.selectedMarker = action.marker;
                this.markersChanged.emit();
            }
            if (action instanceof Actions.AlignmentActions.UpdateMarker) {
                if (action.recordState) {
                    alignmentLabelingStore.alignmentHistoryRecord();
                }
                action.marker.localTimestamp = action.newLocalTimestamp;
                if (action.recompute) {
                    this.alignAllTimeSeries(true);
                }
                this.markersChanged.emit();
            }
            if (action instanceof Actions.AlignmentActions.AddMarkerCorrespondence) {
                alignmentLabelingStore.alignmentHistoryRecord();
                // Remove all conflicting correspondence.
                this._correspondences = this._correspondences.filter((c) => {
                    // Multiple connections.
                    if (c.marker1 === action.marker1 && c.marker2.timeSeries === action.marker2.timeSeries) { return false; }
                    if (c.marker1 === action.marker2 && c.marker2.timeSeries === action.marker1.timeSeries) { return false; }
                    if (c.marker2 === action.marker1 && c.marker1.timeSeries === action.marker2.timeSeries) { return false; }
                    if (c.marker2 === action.marker2 && c.marker1.timeSeries === action.marker1.timeSeries) { return false; }
                    // Crossings.
                    if (c.marker1.timeSeries === action.marker1.timeSeries && c.marker2.timeSeries === action.marker2.timeSeries) {
                        if ((c.marker1.localTimestamp - action.marker1.localTimestamp) *
                            (c.marker2.localTimestamp - action.marker2.localTimestamp) < 0) {
                            return false;
                        }
                    }
                    if (c.marker1.timeSeries === action.marker2.timeSeries && c.marker2.timeSeries === action.marker1.timeSeries) {
                        if ((c.marker1.localTimestamp - action.marker2.localTimestamp) *
                            (c.marker2.localTimestamp - action.marker1.localTimestamp) < 0) {
                            return false;
                        }
                    }
                    return true;
                });

                const corr = { marker1: action.marker1, marker2: action.marker2 };
                this._correspondences.push(corr);
                alignmentUiStore.selectedCorrespondence = corr;
                this.alignAllTimeSeries(true);
                this.markersChanged.emit();
            }
            if (action instanceof Actions.AlignmentActions.DeleteMarkerCorrespondence) {
                alignmentLabelingStore.alignmentHistoryRecord();
                const index = this._correspondences.indexOf(action.correspondence);
                if (index >= 0) {
                    this._correspondences.splice(index, 1);
                    this.alignAllTimeSeries(true);
                    this.markersChanged.emit();
                }
            }
            if (action instanceof Actions.AlignmentActions.DeleteMarker) {
                alignmentLabelingStore.alignmentHistoryRecord();
                const index = this._markers.indexOf(action.marker);
                if (index >= 0) {
                    this._markers.splice(index, 1);
                    this._correspondences = this._correspondences.filter((c) => {
                        return c.marker1 !== action.marker && c.marker2 !== action.marker;
                    });
                    this.alignAllTimeSeries(true);
                    this.markersChanged.emit();
                }
            }
        });
    }

    public get markers(): Marker[] {
        return this._markers;
    }

    public get correspondences(): MarkerCorrespondence[] {
        return this._correspondences;
    }

    // On tracks changed.
    private onTracksChanged(): void {
        this.stopAnimation();

        this._markers = this._markers.filter((m) => {
            return alignmentLabelingStore.getTimeSeriesByID(m.timeSeries.id) !== null;
        });
        this._correspondences = this._correspondences.filter((c) => {
            return this._markers.indexOf(c.marker1) >= 0 && this._markers.indexOf(c.marker2) >= 0;
        });
        this.markersChanged.emit();

        alignmentUiStore.onTracksChanged();
        this.alignAllTimeSeries(true);
    }

    // Find all timeSeries that are connected with series (including series in the reference track).
    public getConnectedSeries(series: AlignedTimeSeries): Set<AlignedTimeSeries> {
        const result = new Set<AlignedTimeSeries>();
        result.add(series);
        let added = true;
        while (added) {
            added = false;
            for (const c of this._correspondences) {
                const h1 = result.has(c.marker1.timeSeries);
                const h2 = result.has(c.marker2.timeSeries);
                if (h1 !== h2) {
                    if (h1) { result.add(c.marker2.timeSeries); }
                    if (h2) { result.add(c.marker1.timeSeries); }
                    added = true;
                }
            }
        }
        return result;
    }

    public getAlignedBlocks(): Set<AlignedTimeSeries>[] {
        const result: Set<AlignedTimeSeries>[] = [];
        const visitedSeries = new Set<AlignedTimeSeries>();
        for (const track of alignmentLabelingStore.tracks) {
            for (const timeSeries of track.alignedTimeSeries) {
                if (!visitedSeries.has(timeSeries)) {
                    const block = this.getConnectedSeries(timeSeries);
                    result.push(block);
                    block.forEach((s) => visitedSeries.add(s));
                }
            }
        }
        return result;
    }

    public isBlockAligned(block: Set<AlignedTimeSeries>): boolean {
        return alignmentLabelingStore.referenceTrack.alignedTimeSeries.some((x) => block.has(x));
    }

    // leastSquares([[yi, xi], ... ]) => [ k, b ] such that sum(k xi + b - yi)^2 is minimized.
    public leastSquares(correspondences: [number, number][]): [number, number] {
        if (correspondences.length === 0) { return null; }
        if (correspondences.length === 1) { return [1, correspondences[0][0] - correspondences[0][1]]; }
        let sumX = 0; let sumY = 0; let sumXX = 0; let sumXY = 0;
        const n = correspondences.length;
        for (let i = 0; i < n; i++) {
            const [y, x] = correspondences[i];
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumXX += x * x;
        }
        const k = (sumXY - sumX * sumY / n) / (sumXX - sumX * sumX / n);
        const b = (sumY - k * sumX) / n;
        return [k, b];
    }

    // Action functions.
    public alignTimeSeries(target: AlignedTimeSeries): [number, number] {
        const tracks = alignmentLabelingStore.tracks;
        const tTrackIndex = tracks.indexOf(target.track);
        // Find all correspondences above.
        const tCorrespondences: [number, number][] = [];
        this.correspondences.forEach((correspondences) => {
            let thisMarker: Marker = null; let otherMarker: Marker = null;
            if (correspondences.marker1.timeSeries === target) {
                [thisMarker, otherMarker] = [correspondences.marker1, correspondences.marker2];
            }
            if (correspondences.marker2.timeSeries === target) {
                [thisMarker, otherMarker] = [correspondences.marker2, correspondences.marker1];
            }
            if (!otherMarker) { return; } // not on this timeseries.
            if (tTrackIndex - 1 !== tracks.indexOf(otherMarker.timeSeries.track)) { return; } // must be the previous track.
            const otherScale = d3.scaleLinear()
                .domain([otherMarker.timeSeries.timeSeries[0].timestampStart, otherMarker.timeSeries.timeSeries[0].timestampEnd])
                .range([otherMarker.timeSeries.referenceStart, otherMarker.timeSeries.referenceEnd]);
            tCorrespondences.push([otherScale(otherMarker.localTimestamp), thisMarker.localTimestamp]);
        });

        // Find the translation and scale for correspondences.
        const lsqr = this.leastSquares(tCorrespondences);
        if (lsqr !== null) {
            const [k, b] = lsqr;
            return [k * target.timeSeries[0].timestampStart + b, k * target.timeSeries[0].timestampEnd + b];
        } else {
            return null;
        }
    }

    // Terminate current animation.
    public stopAnimation(): void {
        if (this._alignmentTransitionController) {
            this._alignmentTransitionController.terminate();
            this._alignmentTransitionController = null;
        }
    }

    public alignAllTimeSeries(animate: boolean = false): void {
        this.stopAnimation();
        const snapshot0 = new TimeSeriesStateSnapshot(this);
        alignmentLabelingStore.tracks.forEach((track) => {
            track.alignedTimeSeries.forEach((ts) => {
                const align = this.alignTimeSeries(ts);
                if (align !== null) {
                    [ts.referenceStart, ts.referenceEnd] = align;
                }
            });
        });
        this.rearrangeSeries();
        if (animate) {
            const snapshot1 = new TimeSeriesStateSnapshot(this);
            snapshot0.apply();
            this._alignmentTransitionController = new TransitionController(100, 'linear', (t, finish) => {
                snapshot0.applyInterpolate(snapshot1, t);
                if (finish) {
                    snapshot1.apply();
                    this.markersChanged.emit();
                    this.alignmentChanged.emit();
                } else {
                    this.markersChanged.emit();
                }
            });
        } else {
            this.markersChanged.emit();
            this.alignmentChanged.emit();
        }
    }

    private rearrangeSeries(animate: boolean = false): void {
        const blocks = this.getAlignedBlocks();
        for (const block of blocks) {
            // If it's a reference track.
            if (this.isBlockAligned(block)) {
                block.forEach((s) => {
                    s.aligned = true;
                    const info = alignmentUiStore.getAlignmentState(s);
                    if (info) {
                        info.rangeStart = alignmentLabelingUiStore.referenceViewStart;
                        info.pixelsPerSecond = alignmentLabelingUiStore.referenceViewPPS;
                    }
                });
            } else {
                const ranges: [number, number][] = [];
                block.forEach((s) => {
                    s.aligned = false;
                    const info = alignmentUiStore.getAlignmentState(s);
                    if (info) {
                        ranges.push([info.rangeStart, info.pixelsPerSecond]);
                    }
                });
                const averageStart = d3.mean(ranges, (x) => x[0]);
                const averagePPS = 1 / d3.mean(ranges, (x) => 1 / x[1]);
                block.forEach((s) => {
                    const info = alignmentUiStore.getAlignmentState(s);
                    if (info) {
                        info.rangeStart = averageStart;
                        info.pixelsPerSecond = averagePPS;
                    }
                });
            }
        }
    }

    // Tracks Changed event, when tracks are added/removed.
    // TODO: This is used in place for other (not-exist-yet) events, fix by adding more events. 
    public markersChanged: NodeEvent = new NodeEvent(this, 'markers-changed');

    // Alignment Changed event, when a new alignment is done (not fire when transition).
    public alignmentChanged: NodeEvent = new NodeEvent(this, 'alignment-changed');


    // Save the alignment state.
    public saveState(): SavedAlignmentState {
        let markerIndex = 0;
        const marker2ID = new Map<Marker, string>();
        const saveMarker = (marker: Marker): SavedMarker => {
            markerIndex += 1;
            const id = 'marker' + markerIndex.toString();
            marker2ID.set(marker, id);
            return {
                id: id,
                timeSeriesID: marker.timeSeries.id,
                localTimestamp: marker.localTimestamp
            };
        };

        const saveMarkerCorrespondence = (c: MarkerCorrespondence): SavedMarkerCorrespondence => {
            return {
                marker1ID: marker2ID.get(c.marker1),
                marker2ID: marker2ID.get(c.marker2)
            };
        };
        return {
            markers: this._markers.map(saveMarker),
            correspondences: this._correspondences.map(saveMarkerCorrespondence),
            timeSeriesStates: new TimeSeriesStateSnapshot(this).toObject()
        };
    }

    // Load from a saved alignment state.
    public loadState(state: SavedAlignmentState): void {
        this.stopAnimation();

        this._markers = [];
        this._correspondences = [];

        const markerID2Marker = new Map<string, Marker>();
        for (const marker of state.markers) {
            const newMarker = {
                timeSeries: alignmentLabelingStore.getTimeSeriesByID(marker.timeSeriesID),
                localTimestamp: marker.localTimestamp
            };
            this._markers.push(newMarker);
            markerID2Marker.set(marker.id, newMarker);
        }
        for (const c of state.correspondences) {
            this._correspondences.push({
                marker1: markerID2Marker.get(c.marker1ID),
                marker2: markerID2Marker.get(c.marker2ID)
            });
        }
        this.markersChanged.emit();
        Object.keys(state.timeSeriesStates).forEach(id => {
            const tsState = state.timeSeriesStates[id];
            const ts = alignmentLabelingStore.getTimeSeriesByID(id);
            alignmentUiStore.setAlignmentState(ts, {
                rangeStart: tsState.rangeStart,
                pixelsPerSecond: tsState.pixelsPerSecond
            });
            ts.referenceStart = tsState.referenceStart;
            ts.referenceEnd = tsState.referenceEnd;
        });
        this.alignAllTimeSeries(false);
    }

    // Reset the alignment stuff.
    public reset(): void {
        this.stopAnimation();

        this._markers = [];
        this._correspondences = [];

        this.markersChanged.emit();

        this.alignAllTimeSeries(false);
    }
}
