// Alignment data structures.

import { TimeSeries } from './dataset';
import * as d3 from 'd3';



function uniqueIdFactory(prefix: string): () => string {
    let id = 0;
    return () => {
        return prefix + id++;
    };
}

const trackIdFactory = uniqueIdFactory('track');






export class Marker {
    public localTimestamp: number;          // The timestamp in the timeseries's time.
    public track: Track;   // The timeseries of the marker.
}


export class MarkerCorrespondence {
    public marker1: Marker;
    public marker2: Marker;
}



export class Track {

    constructor(
        public id: string,
        public minimized: boolean,                  // Is the track minimized. 
        public timeSeries: TimeSeries[],   // should have the same timestampStart and timestampEnd (aka., from the same sensor)
        public source: string,             // The filename of the timeseries. timeSeries should be what loaded from the file.
        public isAlignedToReferenceTrack: boolean,
        public referenceStart: number,     // The starting point of the timeseries in reference time.
        public referenceEnd: number,       // The ending point of the timeseries in reference time.
    ) { }

    // tslint:disable-next-line:function-name
    public static fromFile(fileName: string, timeseries: TimeSeries[]): Track {
        if (timeseries.length === 0) { throw 'Track constructor empty timeseries'; }
        return new Track(
            trackIdFactory(), false,
            timeseries,
            fileName,
            false,
            0, timeseries[0].timestampEnd - timeseries[0].timestampStart
        );
    }

    public toString(): string { return this.id; }

    // tslint:disable-next-line:function-name
    public static clone(other: Track): Track {
        return other == null ? null :
            new Track(
                other.id, other.minimized, other.timeSeries, other.source, other.isAlignedToReferenceTrack,
                other.referenceStart, other.referenceEnd);
    }

    public get duration(): number { return this.referenceEnd - this.referenceStart; }

    public align(correspondences: MarkerCorrespondence[]): void {
        if (correspondences.length === 0) { throw 'AlignedTimeSeries.align correspondences empty'; }

        // Find all correspondences above.
        const tCorrespondences: [number, number][] = [];
        correspondences.forEach(correspondence => {
            let thisMarker: Marker = null; let otherMarker: Marker = null;
            if (correspondence.marker1.track === this) {
                [thisMarker, otherMarker] = [correspondence.marker1, correspondence.marker2];
            }
            if (correspondence.marker2.track === this) {
                [thisMarker, otherMarker] = [correspondence.marker2, correspondence.marker1];
            }
            if (!otherMarker) { return; } // not on this timeseries.
            // if (tTrackIndex - 1 !== tracks.indexOf(otherMarker.timeSeries.track)) { return; } // must be the previous track.
            const otherScale = d3.scaleLinear()
                .domain([otherMarker.track.timeSeries[0].timestampStart, otherMarker.track.timeSeries[0].timestampEnd])
                .range([otherMarker.track.referenceStart, otherMarker.track.referenceEnd]);
            tCorrespondences.push([otherScale(otherMarker.localTimestamp), thisMarker.localTimestamp]);
        });

        // Find the translation and scale for correspondences.
        let [k, b] = leastSquares(tCorrespondences);
        if (isNaN(k) || isNaN(b)) { k = 1; b = 0; } // Is this the right thing to do?
        const project = x => k * x + b;

        this.referenceStart = project(this.timeSeries[0].timestampStart);
        this.referenceEnd = project(this.timeSeries[0].timestampEnd);
    }

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



