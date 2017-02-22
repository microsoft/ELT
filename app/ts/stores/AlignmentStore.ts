import { Marker, MarkerCorrespondence, Track } from './dataStructures/alignment';
import { SavedAlignmentState, SavedMarker, SavedMarkerCorrespondence } from './dataStructures/project';
import { TimeSeriesStateSnapshot } from './dataStructures/TimeSeriesStateSnapshot';
import { projectStore } from './stores';
import { action, computed, observable, reaction } from 'mobx';

// Store alignment markers and correspondences (connections between markers).
export class AlignmentStore {

    // Markers.
    @observable public markers: Marker[];

    // Correspondences between markers.
    @observable public correspondences: MarkerCorrespondence[];

    constructor() {
        this.markers = [];
        this.correspondences = [];

        reaction(
            () => projectStore.tracks,
            () => this.onTracksChanged(),
            { name: 'AlignmentStore.onTracksChanged' });
    }

    @action public addMarker(marker: Marker): void {
        projectStore.alignmentHistoryRecord();
        this.markers.push(marker);
    }

    @action public updateMarker(marker: Marker, newLocalTimestamp: number, recompute: boolean = true, recordState: boolean = true): void {
        if (recordState) {
            projectStore.alignmentHistoryRecord();
        }
        marker.localTimestamp = newLocalTimestamp;
        if (recompute) {
            this.alignAllTracks(true);
        }
    }

    @action public deleteMarker(marker: Marker): void {
        projectStore.alignmentHistoryRecord();
        const index = this.markers.indexOf(marker);
        if (index >= 0) {
            this.markers.splice(index, 1);
            this.correspondences = this.correspondences.filter(c =>
                !c.marker1.equals(marker) && !c.marker2.equals(marker));
            this.alignAllTracks(true);
        }
    }

    @action public addMarkerCorrespondence(marker1: Marker, marker2: Marker): MarkerCorrespondence {
        projectStore.alignmentHistoryRecord();
        const newCorr = new MarkerCorrespondence(marker1, marker2);
        // Remove all conflicting correspondence.
        this.correspondences = this.correspondences.filter(c => c.compatibleWith(newCorr));
        this.correspondences.push(newCorr);
        this.alignAllTracks(true);
        return newCorr;
    }

    @action public deleteMarkerCorrespondence(correspondence: MarkerCorrespondence): void {
        projectStore.alignmentHistoryRecord();
        const index = this.correspondences.indexOf(correspondence);
        if (index >= 0) {
            this.correspondences.splice(index, 1);
            this.alignAllTracks(true);
        }
    }

    // On tracks changed.
    private onTracksChanged(): void {
        this.markers = this.markers.filter(m => {
            return projectStore.getTrackByID(m.track.id) !== null;
        });
        this.correspondences = this.correspondences.filter(c => {
            return this.markers.some(m => m.equals(c.marker1)) &&
                this.markers.some(m => m.equals(c.marker2));
        });
        this.alignAllTracks(true);
    }

    // Find all tracks that are connected with other tracks (including the reference track).
    public getTrackBlock(track: Track): Set<Track> {
        const connected = new Set<Track>();
        connected.add(track);
        let added = true;
        while (added) {
            added = false;
            for (const c of this.correspondences) {
                const has1 = connected.has(c.marker1.track);
                const has2 = connected.has(c.marker2.track);
                if (has1 !== has2) {
                    if (has1) { connected.add(c.marker2.track); }
                    if (has2) { connected.add(c.marker1.track); }
                    added = true;
                }
            }
        }
        return connected;
    }

    @computed public get trackBlocks(): Set<Track>[] {
        const blocks: Set<Track>[] = [];
        const visitedSeries = new Set<Track>();
        for (const track of projectStore.tracks) {
            if (!visitedSeries.has(track)) {
                const block = this.getTrackBlock(track);
                blocks.push(block);
                block.forEach(s => visitedSeries.add(s));
            }
        }
        return blocks;
    }

    // FIXME: animate doesn't do anything?
    public alignAllTracks(animate: boolean = false): void {
        if (this.correspondences.length === 0) { return; }
        projectStore.tracks.forEach(track => {
            track.align(this.correspondences);
        });
    }

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
                trackId: marker.track.id,
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
            markers: this.markers.map(saveMarker),
            correspondences: this.correspondences.map(saveMarkerCorrespondence),
            timeSeriesStates: new TimeSeriesStateSnapshot().toObject()
        };
    }

    // Load from a saved alignment state.
    public loadState(state: SavedAlignmentState): void {
        this.markers = [];
        this.correspondences = [];

        const markerID2Marker = new Map<string, Marker>();
        for (const marker of state.markers) {
            const newMarker = new Marker(marker.localTimestamp, projectStore.getTrackByID(marker.trackId));
            this.markers.push(newMarker);
            markerID2Marker.set(marker.id, newMarker);
        }
        for (const c of state.correspondences) {
            this.correspondences.push(new MarkerCorrespondence(
                markerID2Marker.get(c.marker1ID),
                markerID2Marker.get(c.marker2ID)
            ));
        }
        Object.keys(state.timeSeriesStates).forEach(id => {
            const tsState = state.timeSeriesStates[id];
            const track = projectStore.getTrackByID(id);
            track.referenceStart = tsState.referenceStart;
            track.referenceEnd = tsState.referenceEnd;
        });
        //this.alignAllTracks(false);
    }

    public reset(): void {
        this.markers = [];
        this.correspondences = [];
        this.alignAllTracks(false);
    }
}
