// Alignment data structures.

import { TimeSeries } from './dataset';
import * as d3 from 'd3';
import { observable } from 'mobx';



function uniqueIdFactory(prefix: string): () => string {
    let id = 0;
    return () => {
        return prefix + id++;
    };
}

const trackIdFactory = uniqueIdFactory('track');
const seriesIdFactory = uniqueIdFactory('series');






export class Marker {
    public localTimestamp: number;          // The timestamp in the timeseries's time.
    public timeSeries: AlignedTimeSeries;   // The timeseries of the marker.
}

export class MarkerCorrespondence {
    public marker1: Marker;
    public marker2: Marker;
}


export class AlignedTimeSeries {
    public id: string;

    constructor(
        public trackId: string,
        public referenceStart: number,     // The starting point of the timeseries in reference time.
        public referenceEnd: number,       // The ending point of the timeseries in reference time.
        public timeSeries: TimeSeries[], // should have the same timestampStart and timestampEnd (aka., from the same sensor)
        public source: string, // The filename of the timeseries. timeSeries should be what loaded from the file.
        public aligned: boolean,
    ) {
        this.id = seriesIdFactory();
    }

    // tslint:disable-next-line:function-name
    public static clone(other: AlignedTimeSeries, track: Track): AlignedTimeSeries {
        return new AlignedTimeSeries(
            track.id, other.referenceStart, other.referenceEnd, other.timeSeries, other.source, other.aligned);
    }

    public get duration(): number { return this.referenceEnd - this.referenceStart; }

    public getAlignmentParameters(viewWidth: number): AlignmentParameters {
        return { rangeStart: this.referenceStart, pixelsPerSecond: viewWidth / this.duration };
    }

    public align(correspondences: MarkerCorrespondence[]): [number, number] {
        if (correspondences.length === 0) { throw 'AlignedTimeSeries.align correspondences empty'; }

        // const tracks = alignmentLabelingStore.tracks;
        // const tTrackIndex = tracks.indexOf(this.track);
        // Find all correspondences above.
        const tCorrespondences: [number, number][] = [];
        correspondences.forEach((correspondence) => {
            let thisMarker: Marker = null; let otherMarker: Marker = null;
            if (correspondence.marker1.timeSeries === this) {
                [thisMarker, otherMarker] = [correspondence.marker1, correspondence.marker2];
            }
            if (correspondence.marker2.timeSeries === this) {
                [thisMarker, otherMarker] = [correspondence.marker2, correspondence.marker1];
            }
            if (!otherMarker) { return; } // not on this timeseries.
            // if (tTrackIndex - 1 !== tracks.indexOf(otherMarker.timeSeries.track)) { return; } // must be the previous track.
            const otherScale = d3.scaleLinear()
                .domain([otherMarker.timeSeries.timeSeries[0].timestampStart, otherMarker.timeSeries.timeSeries[0].timestampEnd])
                .range([otherMarker.timeSeries.referenceStart, otherMarker.timeSeries.referenceEnd]);
            tCorrespondences.push([otherScale(otherMarker.localTimestamp), thisMarker.localTimestamp]);
        });

        // Find the translation and scale for correspondences.
        const [k, b] = leastSquares(tCorrespondences);
        return [k * this.timeSeries[0].timestampStart + b, k * this.timeSeries[0].timestampEnd + b];
    }

}



export class Track {

    constructor(
        public id: string,
        public minimized: boolean,                  // Is the track minimized. 
        public alignedTimeSeries: AlignedTimeSeries[]     // The timeseries within the track.
    ) { }

    // tslint:disable-next-line:function-name
    public static fromFile(fileName: string, timeseries: TimeSeries[]): Track {
        if (timeseries.length === 0) { throw 'Track constructor empty timeseries'; }
        const track = new Track(trackIdFactory(), false, []);
        track.alignedTimeSeries = [
            new AlignedTimeSeries(
                track.id,
                0, timeseries[0].timestampEnd - timeseries[0].timestampStart,
                timeseries,
                fileName,
                false
            )
        ];
        return track;
    }

    public foo(): void {
        return;
    }
}



export class AlignmentParameters {
    // rangeStart and pixelsPerSecond in the timeSeries's time.
    public readonly rangeStart: number;
    public readonly pixelsPerSecond: number;
    // Only used when undo/redo.
    public referenceStart?: number;
    public referenceEnd?: number;
}



// leastSquares([[yi, xi], ... ]) => [ k, b ] such that sum(k xi + b - yi)^2 is minimized.
function leastSquares(correspondences: [number, number][]): [number, number] {
    if (correspondences.length === 0) { throw 'leastSquares empty array'; }
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



