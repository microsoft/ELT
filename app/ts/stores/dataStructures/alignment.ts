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






export class Marker {
    constructor(
        public localTimestamp: number,
        public track: Track
    ) { }

    public equals(that: Marker): boolean {
        return this.localTimestamp === that.localTimestamp &&
            this.track.id === that.track.id;
    }
}


export class MarkerCorrespondence {
    constructor(public marker1: Marker, public marker2: Marker) { }

    public compatibleWith(that: MarkerCorrespondence): boolean {
        // Multiple connections.
        if (this.marker1.equals(that.marker1) && this.marker2.track.id === that.marker2.track.id) { return false; }
        if (this.marker1.equals(that.marker2) && this.marker2.track.id === that.marker1.track.id) { return false; }
        if (this.marker2.equals(that.marker1) && this.marker1.track.id === that.marker2.track.id) { return false; }
        if (this.marker2.equals(that.marker2) && this.marker1.track.id === that.marker1.track.id) { return false; }
        // Crossings.
        if (this.marker1.track.id === that.marker1.track.id && this.marker2.track.id === that.marker2.track.id &&
            (this.marker1.localTimestamp - that.marker1.localTimestamp) *
            (this.marker2.localTimestamp - that.marker2.localTimestamp) < 0) {
            return false;
        }
        if (this.marker1.track.id === that.marker2.track.id && this.marker2.track.id === that.marker1.track.id &&
            (this.marker1.localTimestamp - that.marker2.localTimestamp) *
            (this.marker2.localTimestamp - that.marker1.localTimestamp) < 0) {
            return false;
        }
        return true;
    }
}



export class Track {
    public id: string;
    @observable public minimized: boolean;         // Is the track minimized. 
    @observable public timeSeries: TimeSeries[];   // should have the same timestampStart and timestampEnd (aka., from the same sensor)
    public readonly source: string;                // The filename of the timeseries. timeSeries should be what loaded from the file.
    @observable public isAlignedToReferenceTrack: boolean;
    @observable public referenceStart: number;     // The starting point of the timeseries in reference time.
    @observable public referenceEnd: number;       // The ending point of the timeseries in reference time.

    constructor(
        id: string,
        minimized: boolean,
        timeSeries: TimeSeries[],
        source: string,
        isAlignedToReferenceTrack: boolean,
        referenceStart: number,
        referenceEnd: number) {

        this.id = id;
        this.minimized = minimized;
        this.timeSeries = timeSeries;
        this.source = source;
        this.isAlignedToReferenceTrack = isAlignedToReferenceTrack;
        this.referenceStart = referenceStart;
        this.referenceEnd = referenceEnd;
    }

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
            const otherScale = d3.scaleLinear()
                .domain([otherMarker.track.timeSeries[0].timestampStart, otherMarker.track.timeSeries[0].timestampEnd])
                .range([otherMarker.track.referenceStart, otherMarker.track.referenceEnd]);
            tCorrespondences.push([otherScale(otherMarker.localTimestamp), thisMarker.localTimestamp]);
        });

        // Find the translation and scale for correspondences.
        if (tCorrespondences.length === 0) { return; } // FIXME: this fixes alignment undo bug, but seems hacky
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



