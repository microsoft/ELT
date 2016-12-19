// App-level UI Store: Manages the curernt tab.

import * as actions from '../actions/Actions';
import { TransitionController } from '../common/common';
import { TabID } from '../common/ui/types';
import { globalDispatcher } from '../dispatcher/globalDispatcher';
import { NodeEvent } from './NodeEvent';
import * as stores from './stores';
import * as d3 from 'd3';
import { EventEmitter } from 'events';


export class UiStore extends EventEmitter {
    private _currentTab: TabID;
    // Zooming view parameters.
    private _viewWidth: number;
    private _referenceViewStart: number;
    private _referenceViewPPS: number;
    // Keep the time range of the reference track.
    private _referenceTimestampStart: number;
    private _referenceTimestampEnd: number;
    // Global cursor.
    private _referenceViewTimeCursor: number;
    // Current transition.
    private _referenceViewTransition: TransitionController;

    public tabChanged: NodeEvent = new NodeEvent(this, 'tab-changed');
    public referenceViewChanged: NodeEvent = new NodeEvent(this, 'reference-view-changed');
    public referenceViewTimeCursorChanged: NodeEvent = new NodeEvent(this, 'reference-view-time-cursor-changed');

    constructor() {
        super();

        this._currentTab = 'file';

        globalDispatcher.register(action => {
            if (action instanceof actions.Actions.SwitchTabAction) {
                this._currentTab = action.tab;
                this.tabChanged.emit();
            }
        });
        // Initialize reference view parameters.
        this._referenceTimestampStart = 0;
        this._referenceTimestampEnd = 100;
        // Initial setup.
        this._viewWidth = 800;
        this._referenceViewStart = 0;
        this._referenceViewPPS = 0.1;
        this._referenceViewTransition = null;
        this._referenceViewTimeCursor = null;
        // Listen to the track changed event from the alignmentLabelingStore.
        stores.alignmentLabelingStore.tracksChanged.on(this.onTracksChanged.bind(this));
        globalDispatcher.register(action => {
            if (action instanceof actions.CommonActions.UIAction) {
                this.handleUiAction(action);
            }
        });
    }

    public get currentTab(): TabID {
        return this._currentTab;
    }
    public set currentTab(tab: TabID) {
        this._currentTab = tab;
        this.tabChanged.emit();
    }

    // On tracks changed, update zooming parameters so that the views don't overflow.
    public onTracksChanged(): void {
        if (stores.alignmentLabelingStore.referenceTrack) {
            this._referenceTimestampStart =
                d3.min(stores.alignmentLabelingStore.referenceTrack.alignedTimeSeries, (x) => x.referenceStart);
            this._referenceTimestampEnd =
                d3.max(stores.alignmentLabelingStore.referenceTrack.alignedTimeSeries, (x) => x.referenceEnd);
            [this._referenceViewStart, this._referenceViewPPS] =
                this.constrainDetailedViewZoomingParameters(this._referenceViewStart, this._referenceViewPPS);
            this.referenceViewChanged.emit();
        }
    }

    // Exposed properties.
    // Detailed view zooming and translation.
    public get referenceViewStart(): number { return this._referenceViewStart; }
    public get referenceViewDuration(): number { return this._viewWidth / this._referenceViewPPS; }
    public get referenceViewEnd(): number { return this._referenceViewStart + this._viewWidth / this._referenceViewPPS; }
    public get referenceViewPPS(): number { return this._referenceViewPPS; }
    public get referenceViewTimeCursor(): number { return this._referenceViewTimeCursor; }
    public get referenceTimestampStart(): number { return this._referenceTimestampStart; }
    public get referenceTimestampEnd(): number { return this._referenceTimestampEnd; }
    public get viewWidth(): number { return this._viewWidth; }

    // Set the zooming parameters.
    public setReferenceViewZooming(referenceViewStart: number, referenceViewPPS: number): void {
        [referenceViewStart, referenceViewPPS] = this.constrainDetailedViewZoomingParameters(referenceViewStart, referenceViewPPS);
        this._referenceViewStart = referenceViewStart;
        this._referenceViewPPS = referenceViewPPS;
        this.referenceViewChanged.emit();
    }


    public handleUiAction(action: actions.CommonActions.UIAction): void {
        if (action instanceof actions.CommonActions.SetViewWidth) {
            this._viewWidth = action.width;
            [this._referenceViewStart, this._referenceViewPPS] =
                this.constrainDetailedViewZoomingParameters(this._referenceViewStart, this._referenceViewPPS);
            this.referenceViewChanged.emit();
        }

        if (action instanceof actions.CommonActions.SetReferenceViewZooming) {
            if (action.referenceViewStart == null) { action.referenceViewStart = this._referenceViewStart; }
            if (action.referenceViewPPS == null) { action.referenceViewPPS = this._referenceViewPPS; }
            const [referenceViewStart, referenceViewPPS] =
                this.constrainDetailedViewZoomingParameters(action.referenceViewStart, action.referenceViewPPS);
            // Change current class to label's class.
            if (this._referenceViewStart !== referenceViewStart || this._referenceViewPPS !== referenceViewPPS) {
                if (!action.animate) {
                    if (this._referenceViewTransition) {
                        this._referenceViewTransition.terminate();
                        this._referenceViewTransition = null;
                    }
                    this._referenceViewStart = referenceViewStart;
                    this._referenceViewPPS = referenceViewPPS;
                    this.referenceViewChanged.emit();
                } else {
                    if (this._referenceViewTransition) {
                        this._referenceViewTransition.terminate();
                        this._referenceViewTransition = null;
                    }
                    const start0 = this._referenceViewStart;
                    const zoom0 = this._referenceViewPPS;
                    const start1 = referenceViewStart;
                    const zoom1 = referenceViewPPS;
                    this._referenceViewTransition = new TransitionController(100, 'linear', (t: number) => {
                        this._referenceViewStart = start0 + (start1 - start0) * t;
                        if (zoom1) {
                            this._referenceViewPPS = 1 / (1 / zoom0 + (1 / zoom1 - 1 / zoom0) * t);
                        }
                        this.referenceViewChanged.emit();
                    });
                }
            }
        }

        if (action instanceof actions.CommonActions.ReferenceViewPanAndZoom) {
            if (action.zoom !== 0) {
                const k = Math.exp(-action.zoom);
                // Two rules to compute new zooming.
                // 1. Time cursor should be preserved: (time_cursor - old_start) * old_pps = (time_cursor - new_start) * new_pps
                // 2. Zoom factor should be applied: new_start = k * old_start
                const oldPPS = this.referenceViewPPS;
                const oldStart = this.referenceViewStart;
                let timeCursor = this.referenceViewStart + this.referenceViewDuration / 2;
                if (action.zoomCenter === 'cursor') { timeCursor = this._referenceViewTimeCursor; }
                const newPPS = oldPPS * k;
                const newStart = oldStart / k + timeCursor * (1 - 1 / k);
                this.handleUiAction(new actions.CommonActions.SetReferenceViewZooming(newStart, newPPS, false));
            }
            if (action.percentage !== 0) {
                const originalStart = this.referenceViewStart;
                const timeWidth = this.referenceViewDuration;
                this.handleUiAction(
                    new actions.CommonActions.SetReferenceViewZooming(originalStart + timeWidth * action.percentage, null, true));
            }
        }

        if (action instanceof actions.CommonActions.SetReferenceViewTimeCursor) {
            // Change current class to label's class.
            if (this._referenceViewTimeCursor !== action.timeCursor) {
                this._referenceViewTimeCursor = action.timeCursor;
                this.referenceViewTimeCursorChanged.emit();
            }
        }
    }


    // Return updated zooming parameters so that they don't exceed the reference track range.
    private constrainDetailedViewZoomingParameters(referenceViewStart: number, referenceViewPPS: number): [number, number] {
        if (referenceViewStart === null) { referenceViewStart = this.referenceViewStart; }
        if (referenceViewPPS === null) { referenceViewPPS = this.referenceViewPPS; }
        // Check if we go outside of the view, if yes, tune the parameters.
        referenceViewPPS = Math.max(this._viewWidth / (this._referenceTimestampEnd - this._referenceTimestampStart), referenceViewPPS);
        referenceViewStart = Math.max(
            this._referenceTimestampStart,
            Math.min(this._referenceTimestampEnd - this._viewWidth / referenceViewPPS, referenceViewStart));
        return [referenceViewStart, referenceViewPPS];
    }
}
