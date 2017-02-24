import { projectStore, projectUiStore } from '../stores';

// Take a snapshot from the alignmentStore, isolate all current rendering parameters.
interface TimeSeriesStateSnapshotInfo {
    referenceStart: number;
    referenceEnd: number;
    rangeStart: number;
    pixelsPerSecond: number;
}


export class TimeSeriesStateSnapshot {
    private data: Map<string, TimeSeriesStateSnapshotInfo>;

    constructor() {
        this.data = new Map<string, TimeSeriesStateSnapshotInfo>();
        // Take the snapshot.
        projectStore.tracks.forEach(track => {
            const state = projectUiStore.getTrackPanZoom(track);
            this.data.set(track.id, {
                referenceStart: track.referenceStart,
                referenceEnd: track.referenceEnd,
                rangeStart: state ? state.rangeStart : null,
                pixelsPerSecond: state ? state.pixelsPerSecond : null
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

}



