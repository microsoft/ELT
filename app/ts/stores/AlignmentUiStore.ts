// UI states for alignment.

import { Marker, MarkerCorrespondence, Track } from '../stores/dataStructures/alignment';
import { AlignmentStore } from './AlignmentStore';
import { PanZoomParameters, ProjectUiStore } from './ProjectUiStore';
import { alignmentStore, projectStore, projectUiStore } from './stores';
import { TransitionController } from './utils';
import * as d3 from 'd3';
import { action, observable, ObservableMap, reaction } from 'mobx';




export class AlignmentUiStore {

    // Individually stores current time cursor for track.
    // The timeCursors should be in the series's own timestamps.
    @observable private _trackTimeCursor: ObservableMap<number>;

    @observable private _panZoomParameterMap: ObservableMap<PanZoomParameters>;

    // Currently selected markers OR correspondence (update one should cause the other to be null).
    @observable public selectedMarker: Marker;
    @observable public selectedCorrespondence: MarkerCorrespondence;

    private _alignmentTransitionController: TransitionController;

    constructor(alignmentStore: AlignmentStore, projectUiStore: ProjectUiStore) {
        this._trackTimeCursor = observable.map<number>();
        this._panZoomParameterMap = observable.map<PanZoomParameters>();
        this.selectedMarker = null;
        this.selectedCorrespondence = null;

        this.getTimeCursor = this.getTimeCursor.bind(this);

        reaction(
            () => observable([alignmentStore.trackBlocks, projectUiStore.referencePanZoom]),
            () => this.updatePanZoomBasedOnAlignment(),
            { name: 'AlignmentUiStore.updatePanZoomBasedOnAlignment' }
        );
    }

    @action public setTimeCursor(track: Track, timeCursor: number): void {
        this._trackTimeCursor.set(track.id.toString(), timeCursor);
    }

    public getTimeCursor(track: Track): number {
        return this._trackTimeCursor.get(track.id.toString());
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
            return projectUiStore.referencePanZoom;
        }
        if (!this._panZoomParameterMap.has(track.id)) {
            this.setPanZoomParameters(
                track,
                new PanZoomParameters(track.referenceStart, projectUiStore.viewWidth / track.duration));
        }
        return this._panZoomParameterMap.get(track.id);
    }

    @action public setPanZoomParameters(track: Track, panZoom: PanZoomParameters): void {
        if (!projectStore.isReferenceTrack(track)) {
            this._panZoomParameterMap.set(track.id.toString(), panZoom);
        }
    }

    @action public setBlockPanZoom(track: Track, rangeStart: number, pixelsPerSecond: number): void {
        const block = alignmentStore.getConnectedTracks(track);
        block.forEach(trackInBlock => {
            this._panZoomParameterMap.set(
                trackInBlock.id.toString(), new PanZoomParameters(rangeStart, pixelsPerSecond));
        });
    }

    private blockHasReferenceTrack(block: Set<Track>): boolean {
        return block.has(projectStore.referenceTrack);
    }

    // Terminate current animation.
    public stopAnimation(): void {
        if (this._alignmentTransitionController) {
            this._alignmentTransitionController.terminate();
            this._alignmentTransitionController = null;
        }
    }


    public updatePanZoomBasedOnAlignment(animate: boolean = false): void {
        this.stopAnimation();
        const change: (track: Track, pz: PanZoomParameters) => void = animate ?
            (track, target) => {
                const original = target;
                this._alignmentTransitionController = new TransitionController(
                    100, 'linear',
                    action('setReferenceTrackPanZoom animation', (fraction: number) => {
                        this.setPanZoomParameters(track, original.interpolate(target, fraction));
                    }));
            } :
            (track, panZoom) => {
                this.setPanZoomParameters(track, panZoom);
            };

        // A "block" is a set of connected tracks.
        for (const block of alignmentStore.trackBlocks) {
            // If it's a reference track.
            if (this.blockHasReferenceTrack(block)) {
                block.forEach(track => {
                    track.isAlignedToReferenceTrack = true;
                    change(track, projectUiStore.referencePanZoom);
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
                const avg = new PanZoomParameters(d3.mean(ranges, x => x[0]), 1 / d3.mean(ranges, x => 1 / x[1]));
                block.forEach(track => change(track, avg));
            }
        }
    }

}
