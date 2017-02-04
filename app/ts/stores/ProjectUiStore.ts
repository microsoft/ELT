import { Marker, MarkerCorrespondence, Track } from './dataStructures/alignment';
import { TimeRange } from './dataStructures/labeling';
import { PanZoomParameters } from './dataStructures/PanZoomParameters';
import { TabID } from './dataStructures/types';
import { ProjectStore } from './ProjectStore';
import { alignmentStore, projectStore } from './stores';
import { TransitionController } from './utils';
import * as d3 from 'd3';
import { action, autorun, computed, observable, ObservableMap, reaction } from 'mobx';



export class ProjectUiStore {

    @observable public viewWidth: number;
    @observable public currentTab: TabID;

    // Current transition.
    private _referenceViewTransition: TransitionController;

    // Individually stores current time cursor for track.
    // The timeCursors should be in the series's own timestamps.
    private _trackTimeCursor: ObservableMap<number>;
    private _panZoomParameterMap: ObservableMap<PanZoomParameters>;

    // Currently selected markers OR correspondence (update one should cause the other to be null).
    @observable public selectedMarker: Marker;
    @observable public selectedCorrespondence: MarkerCorrespondence;

    private _alignmentTransitionController: TransitionController;

    constructor(projectStore: ProjectStore) {
        this.viewWidth = 800;
        this._referenceViewTransition = null;
        this.currentTab = 'file';
        this._trackTimeCursor = observable.map<number>();
        this._panZoomParameterMap = observable.map<PanZoomParameters>();
        this.selectedMarker = null;
        this.selectedCorrespondence = null;

        this.getTimeCursor = this.getTimeCursor.bind(this);

        autorun('ProjectUiStore.onTracksChanged', () => this.onTracksChanged());
        reaction(
            () => alignmentStore.trackBlocks,
            () => this.updatePanZoomBasedOnAlignment(),
            { name: 'ProjectUiStore.updatePanZoomBasedOnAlignment' }
        );
    }

    // On tracks changed, update zooming parameters so that the views don't overflow.
    public onTracksChanged(): void {
        if (projectStore.referenceTrack) {
            this.setReferenceTrackPanZoom(this.referenceTrackPanZoom, false);
        }
    }

    @computed public get referenceTrackDuration(): number {
        return this.viewWidth / this.referenceTrackPanZoom.pixelsPerSecond;
    }

    @computed public get referenceTrackTimeRange(): TimeRange {
        return {
            timestampStart: this.referenceTrackPanZoom.rangeStart,
            timestampEnd: this.referenceTrackPanZoom.getTimeFromX(this.viewWidth)
        };
    }

    @computed public get referenceTrackPanZoom(): PanZoomParameters {
        return projectStore.referenceTrack ?
            this.getTrackPanZoom(projectStore.referenceTrack) :
            new PanZoomParameters(0, 0.1);
    }

    @action
    public setViewWidth(width: number): void {
        this.viewWidth = width;
        this.setReferenceTrackPanZoom(this.referenceTrackPanZoom, false);
    }

    @action
    public setReferenceTrackPanZoom(target: PanZoomParameters, animate: boolean = false): void {
        if (!projectStore.referenceTrack) { return; }
        target = this.referenceTrackPanZoom.constrain(target, this.viewWidth, {
            timestampStart: projectStore.referenceTimestampStart,
            timestampEnd: projectStore.referenceTimestampEnd
        });
        if (this.referenceTrackPanZoom.equals(target)) { return; }
        this.setTrackPanZoom(projectStore.referenceTrack, target);
    }

    @action
    public zoomReferenceTrack(zoom: number, zoomCenter: 'cursor' | 'center'): void {
        if (zoom === 0) { throw 'bad zoom'; }
        const original = this.referenceTrackPanZoom;
        const k = Math.exp(-zoom);
        // Two rules to compute new zooming.
        // 1. Time cursor should be preserved: (time_cursor - old_start) * old_pps = (time_cursor - new_start) * new_pps
        // 2. Zoom factor should be applied: new_start = k * old_start
        let timeCursor = this.referenceTrackPanZoom.rangeStart + this.referenceTrackDuration / 2;
        if (zoomCenter === 'cursor') { timeCursor = this.referenceTrackTimeCursor; }
        const newPPS = original.pixelsPerSecond * k;
        const newStart = original.rangeStart / k + timeCursor * (1 - 1 / k);
        this.setReferenceTrackPanZoom(new PanZoomParameters(newStart, newPPS), false);
    }

    @action
    public zoomReferenceTrackByPercentage(percentage: number): void {
        const original = this.referenceTrackPanZoom;
        const timeWidth = this.referenceTrackDuration;
        this.setReferenceTrackPanZoom(new PanZoomParameters(original.rangeStart + timeWidth * percentage, null), true);
    }

    @computed get referenceTrackTimeCursor(): number {
        return this.getTimeCursor(projectStore.referenceTrack);
    }

    @action
    public setReferenceTrackTimeCursor(timeCursor: number): void {
        this.setTimeCursor(projectStore.referenceTrack, timeCursor);
        const block = alignmentStore.getTrackBlock(projectStore.referenceTrack);
        block.forEach(track => {
            const scale = d3.scaleLinear()
                .domain([track.referenceStart, track.referenceEnd])
                .range([track.timeSeries[0].timestampStart, track.timeSeries[0].timestampEnd]);
            this.setTimeCursor(track, scale(timeCursor));
        });
    }

    public getTimeCursor(track: Track): number {
        return this._trackTimeCursor.get(track.id.toString());
    }

    @action public setTimeCursor(track: Track, timeCursor: number): void {
        this._trackTimeCursor.set(track.id.toString(), timeCursor);
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

    public getTrackPanZoom(track: Track): PanZoomParameters {
        return this._panZoomParameterMap.has(track.id) ?
            this._panZoomParameterMap.get(track.id) :
            new PanZoomParameters(track.referenceStart, this.viewWidth / track.duration); // show whole track by default
    }

    @action public setTrackPanZoom(track: Track, panZoom: PanZoomParameters): void {
        const block = alignmentStore.getTrackBlock(track);
        this.setBlockPanZoom(block, panZoom);
    }

    private setBlockPanZoom(block: Set<Track>, target: PanZoomParameters): void {
        const trackId = block.keys().next().value.id;
        const sharedPanZoom = this._panZoomParameterMap.has(trackId) ?
            this._panZoomParameterMap.get(trackId) : new PanZoomParameters(0, 1);
        sharedPanZoom.rangeStart = target.rangeStart;
        sharedPanZoom.pixelsPerSecond = target.pixelsPerSecond;
        block.forEach(track => {
            this._panZoomParameterMap.set(track.id, sharedPanZoom);
        });
    }

    // Terminate current animation.
    public stopAnimation(): void {
        if (this._alignmentTransitionController) {
            this._alignmentTransitionController.terminate();
            this._alignmentTransitionController = null;
        }
    }

    private getChangeFunction(animate: boolean): (block: Set<Track>, pz: PanZoomParameters) => void {
        return animate ?
            (block, target) => {
                const original = target;
                this._alignmentTransitionController = new TransitionController(
                    100, 'linear',
                    action('setReferenceTrackPanZoom animation', (fraction: number) => {
                        const interp = original.interpolate(target, fraction);
                        this.setBlockPanZoom(block, interp);
                    }));
            } :
            (block, target) => {
                this.setBlockPanZoom(block, target);
            };
    }

    private updatePanZoomBasedOnAlignment(animate: boolean = false): void {
        this.stopAnimation();
        const change = this.getChangeFunction(animate);

        // A "block" is a set of connected tracks.
        for (const block of alignmentStore.trackBlocks) {
            // If it's a reference track.
            if (block.has(projectStore.referenceTrack)) {
                block.forEach(track => track.isAlignedToReferenceTrack = true);
                change(block, this.referenceTrackPanZoom);
            } else {
                const ranges: [number, number][] = [];
                block.forEach(track => {
                    track.isAlignedToReferenceTrack = false;
                    const alignmentParms = this.getTrackPanZoom(track);
                    if (alignmentParms) {
                        ranges.push([alignmentParms.rangeStart, alignmentParms.pixelsPerSecond]);
                    }
                });
                change(block, new PanZoomParameters(d3.mean(ranges, x => x[0]), 1 / d3.mean(ranges, x => 1 / x[1])));
            }
        }
    }

}
