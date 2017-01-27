import { alignmentUiStore, projectStore } from '../stores';


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
            const state = alignmentUiStore.getAlignmentParameters(track);
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

    // Apply the snapshot to the store.
    public apply(): void {
        this.data.forEach((info, trackId) => {
            const series = projectStore.getTrackByID(trackId);
            if (!series) { return; }
            series.referenceStart = info.referenceStart;
            series.referenceEnd = info.referenceEnd;
            alignmentUiStore.setAlignmentParameters(
                series,
                { rangeStart: info.rangeStart, pixelsPerSecond: info.pixelsPerSecond }
            );
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
        this.data.forEach((info, trackID) => {
            const series = projectStore.getTrackByID(trackID);
            if (!series) { return; }
            const info2 = s2.data.get(trackID);
            series.referenceStart = mix(info.referenceStart, info2.referenceStart);
            series.referenceEnd = mix(info.referenceEnd, info2.referenceEnd);
            alignmentUiStore.setAlignmentParameters(
                series,
                {
                    rangeStart: mix(info.rangeStart, info2.rangeStart),
                    pixelsPerSecond: mixINV(info.pixelsPerSecond, info2.pixelsPerSecond)
                }
            );
        });
    }
}



