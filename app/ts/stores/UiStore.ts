// App-level UI Store: Manages the curernt tab.

import { TabID } from '../stores/dataStructures/types';
import { TransitionController } from '../stores/utils';
import * as stores from './stores';
import * as d3 from 'd3';
import { action, autorun, observable } from 'mobx';


export class UiStore {
    @observable public currentTab: TabID;
    // Zooming view parameters.
    @observable public viewWidth: number;
    @observable public referenceViewStart: number;
    @observable public referenceViewPPS: number;
    // Keep the time range of the reference track.
    @observable public referenceTimestampStart: number;
    @observable public referenceTimestampEnd: number;
    // Global cursor.
    @observable public referenceViewTimeCursor: number;
    // Current transition.
    private _referenceViewTransition: TransitionController;

    // FIXME: computed?
    public get referenceViewDuration(): number { return this.viewWidth / this.referenceViewPPS; }
    public get referenceViewEnd(): number { return this.referenceViewStart + this.viewWidth / this.referenceViewPPS; }


    constructor() {
        this.currentTab = 'file';

        // Initialize reference view parameters.
        this.referenceTimestampStart = 0;
        this.referenceTimestampEnd = 100;
        // Initial setup.
        this.viewWidth = 800;
        this.referenceViewStart = 0;
        this.referenceViewPPS = 0.1;
        this._referenceViewTransition = null;
        this.referenceViewTimeCursor = null;
        // Listen to the track changed event from the alignmentLabelingStore.
        // stores.alignmentLabelingStore.tracksChanged.on(this.onTracksChanged.bind(this));
        autorun(() => this.onTracksChanged());
    }

    @action
    public switchTab(tab: TabID): void {
        this.currentTab = tab;
    }

    // On tracks changed, update zooming parameters so that the views don't overflow.
    public onTracksChanged(): void {
        if (stores.alignmentLabelingStore.referenceTrack) {
            this.referenceTimestampStart =
                d3.min(stores.alignmentLabelingStore.referenceTrack.alignedTimeSeries, (x) => x.referenceStart);
            this.referenceTimestampEnd =
                d3.max(stores.alignmentLabelingStore.referenceTrack.alignedTimeSeries, (x) => x.referenceEnd);
            [this.referenceViewStart, this.referenceViewPPS] =
                this.constrainDetailedViewZoomingParameters(this.referenceViewStart, this.referenceViewPPS);
        }
    }


    // FIXME: I don't think anyone calls this and it conflicts with the action of the same name
    // Set the zooming parameters.
    public setReferenceViewZooming(referenceViewStart: number, referenceViewPPS: number): void {
        [referenceViewStart, referenceViewPPS] = this.constrainDetailedViewZoomingParameters(referenceViewStart, referenceViewPPS);
        this.referenceViewStart = referenceViewStart;
        this.referenceViewPPS = referenceViewPPS;
    }

    // FIXME: the passed in parameters conflict with properties of this class so I appended each with "Val"
    @action
    public setReferenceViewZoomingAction(referenceViewStartVal: number, referenceViewPPSVal: number = null, animate: boolean = false): void{
         if (referenceViewStartVal == null) { referenceViewStartVal = this.referenceViewStart; }
            if (referenceViewPPSVal == null) { referenceViewPPSVal = this.referenceViewPPS; }
            const [referenceViewStart, referenceViewPPS] =
                this.constrainDetailedViewZoomingParameters(referenceViewStartVal, referenceViewPPSVal);
            // Change current class to label's class.
            if (this.referenceViewStart !== referenceViewStart || this.referenceViewPPS !== referenceViewPPS) {
                if (!animate) {
                    if (this._referenceViewTransition) {
                        this._referenceViewTransition.terminate();
                        this._referenceViewTransition = null;
                    }
                    this.referenceViewStart = referenceViewStart;
                    this.referenceViewPPS = referenceViewPPS;
                } else {
                    if (this._referenceViewTransition) {
                        this._referenceViewTransition.terminate();
                        this._referenceViewTransition = null;
                    }
                    const start0 = this.referenceViewStart;
                    const zoom0 = this.referenceViewPPS;
                    const start1 = referenceViewStart;
                    const zoom1 = referenceViewPPS;
                    this._referenceViewTransition = new TransitionController(100, 'linear', (t: number) => {
                        this.referenceViewStart = start0 + (start1 - start0) * t;
                        if (zoom1) {
                            this.referenceViewPPS = 1 / (1 / zoom0 + (1 / zoom1 - 1 / zoom0) * t);
                        }
                    });
                }
            }
    }

    @action 
    public setViewWidth(width: number): void {
          this.viewWidth = width;
            [this.referenceViewStart, this.referenceViewPPS] =
                this.constrainDetailedViewZoomingParameters(this.referenceViewStart, this.referenceViewPPS);
    }


   // FIXME: also called in alignmentLabelingUIStore.
    @action
    public referenceViewPanAndZoom(zoom: number, percentage: number, zoomCenter: 'cursor' | 'center' = 'cursor'): void {
         if (zoom !== 0) {
                const k = Math.exp(-zoom);
                // Two rules to compute new zooming.
                // 1. Time cursor should be preserved: (time_cursor - old_start) * old_pps = (time_cursor - new_start) * new_pps
                // 2. Zoom factor should be applied: new_start = k * old_start
                const oldPPS = this.referenceViewPPS;
                const oldStart = this.referenceViewStart;
                let timeCursor = this.referenceViewStart + this.referenceViewDuration / 2;
                if (zoomCenter === 'cursor') { timeCursor = this.referenceViewTimeCursor; }
                const newPPS = oldPPS * k;
                const newStart = oldStart / k + timeCursor * (1 - 1 / k);
                this.setReferenceViewZoomingAction(newStart, newPPS, false);
            }
            if (percentage !== 0) {
                const originalStart = this.referenceViewStart;
                const timeWidth = this.referenceViewDuration;
                this.setReferenceViewZoomingAction(originalStart + timeWidth * percentage, null, true);
            }
    }


    // FIXME: also called in alignmentLabelingUIStore.
    @action 
    public setReferenceViewTimeCursor(timeCursor: number): void {
        // Change current class to label's class.
        if (this.referenceViewTimeCursor !== timeCursor) {
            this.referenceViewTimeCursor = timeCursor;
        }
    }


    // Return updated zooming parameters so that they don't exceed the reference track range.
    private constrainDetailedViewZoomingParameters(referenceViewStart: number, referenceViewPPS: number): [number, number] {
        if (referenceViewStart === null) { referenceViewStart = this.referenceViewStart; }
        if (referenceViewPPS === null) { referenceViewPPS = this.referenceViewPPS; }
        // Check if we go outside of the view, if yes, tune the parameters.
        referenceViewPPS = Math.max(this.viewWidth / (this.referenceTimestampEnd - this.referenceTimestampStart), referenceViewPPS);
        referenceViewStart = Math.max(
            this.referenceTimestampStart,
            Math.min(this.referenceTimestampEnd - this.viewWidth / referenceViewPPS, referenceViewStart));
        return [referenceViewStart, referenceViewPPS];
    }
}
