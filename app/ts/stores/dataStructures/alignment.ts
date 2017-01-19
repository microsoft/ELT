// Alignment data structures.

import {TimeSeries} from './dataset';

export interface MarkerCorrespondence {
    marker1: Marker;
    marker2: Marker;
}

export interface AlignedTimeSeries {
    id: string;                 // The ID of this timeseries.
   // track: Track;
    referenceStart: number;     // The starting point of the timeseries in reference time.
    referenceEnd: number;       // The ending point of the timeseries in reference time.

    // The timeseries, multiple series should have the same timestampStart and timestampEnd 
    // (aka., from the same sensor).
    timeSeries: TimeSeries[];

    // The filename of the timeseries. timeSeries should be what loaded from the file.
    source: string;

    aligned: boolean;
}

export interface Marker {
    localTimestamp: number;          // The timestamp in the timeseries's time.
    timeSeries: AlignedTimeSeries;   // The timeseries of the marker.
}

export interface Track {
    id: string;
    alignedTimeSeries: AlignedTimeSeries[];     // The timeseries within the track.
    minimized: boolean;                  // Is the track minimized. 
}

export interface AlignmentState {
    // rangeStart and pixelsPerSecond in the timeSeries's time.
    rangeStart: number;
    pixelsPerSecond: number;
    // Only used when undo/redo.
    referenceStart?: number;
    referenceEnd?: number;
}
