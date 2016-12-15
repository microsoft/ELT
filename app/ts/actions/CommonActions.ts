// Common actions.

import {Track} from '../common/common';
import {ActionBase} from './ActionBase';


export module CommonActions {

    export class UIAction extends ActionBase {
    }

    export class NewProject extends ActionBase {
    }

    export class LoadReferenceTrack extends ActionBase {
        constructor(
            public fileName: string
        ) { super(); }
    }

    export class LoadSensorTrack extends ActionBase {
        constructor(
            public fileName: string
        ) { super(); }
    }

    export class LoadVideoTrack extends ActionBase {
        constructor(
            public fileName: string
        ) { super(); }
    }

    export class DeleteTrack extends ActionBase {
        constructor(
            public track: Track
        ) { super(); }
    }

    export class SaveProject extends ActionBase {
        constructor(
            public fileName: string
        ) { super(); }
    }

    export class LoadProject extends ActionBase {
        constructor(
            public fileName: string
        ) { super(); }
    }

    export class AlignmentUndo extends ActionBase {
    }
    export class AlignmentRedo extends ActionBase {
    }
    export class LabelingUndo extends ActionBase {
    }
    export class LabelingRedo extends ActionBase {
    }

    export class SetViewWidth extends UIAction {
        constructor(
            public width: number
        ) { super(); }
    }

    export class SetReferenceViewZooming extends UIAction {
        constructor(
            public referenceViewStart: number,
            public referenceViewPPS: number = null,
            public animate: boolean = false
        ) { super(); }
    }

    export class ReferenceViewPanAndZoom extends UIAction {
        constructor(
            public percentage: number,
            public zoom: number,
            public zoomCenter: 'cursor' | 'center' = 'cursor'
        ) { super(); }
    }

    export class SetReferenceViewTimeCursor extends UIAction {
        constructor(
            public timeCursor: number
        ) { super(); }
    }

}
