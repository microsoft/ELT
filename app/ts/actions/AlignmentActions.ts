// Alignment actions.

import {AlignedTimeSeries, Marker, MarkerCorrespondence, Track} from '../common/common';
import {ActionBase} from './ActionBase';
import {CommonActions} from './CommonActions';


export module AlignmentActions {

    export class AddMarker extends ActionBase {
        constructor(
            public marker: Marker
        ) { super(); }
    }

    export class UpdateMarker extends ActionBase {
        constructor(
            public marker: Marker,
            public newLocalTimestamp: number,
            public recompute: boolean = true,
            public recordState: boolean = true
        ) { super(); }
    }

    export class DeleteMarker extends ActionBase {
        constructor(
            public marker: Marker
        ) { super(); }
    }

    export class AddMarkerCorrespondence extends ActionBase {
        constructor(
            public marker1: Marker,
            public marker2: Marker
        ) { super(); }
    }

    export class DeleteMarkerCorrespondence extends ActionBase {
        constructor(
            public correspondence: MarkerCorrespondence
        ) { super(); }
    }

    export class SetSeriesTimeCursor extends CommonActions.UIAction {
        constructor(
            public series: AlignedTimeSeries,
            public timeCursor: number
        ) { super(); }
    }

    export class SetTimeSeriesZooming extends CommonActions.UIAction {
        constructor(
            public series: AlignedTimeSeries,
            public rangeStart?: number,
            public pixelsPerSecond?: number
        ) { super(); }
    }

    export class SelectMarker extends CommonActions.UIAction {
        constructor(
            public marker: Marker
        ) { super(); }
    }

    export class SelectMarkerCorrespondence extends CommonActions.UIAction {
        constructor(
            public correspondence: MarkerCorrespondence
        ) { super(); }
    }

    export class SetTrackMinimized extends CommonActions.UIAction {
        constructor(
            public track: Track,
            public minimized: boolean
        ) { super(); }
    }
}
