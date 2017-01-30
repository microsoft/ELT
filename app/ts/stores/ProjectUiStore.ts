import { Track } from '../stores/dataStructures/alignment';
import { TabID } from '../stores/dataStructures/types';
import { TransitionController } from '../stores/utils';
import { projectStore } from './stores';
import { action, autorun, IObservableArray, observable } from 'mobx';




// AlignmentLabelingUiStore: UI States for common part of alignment and labeling: the global zooming level. 
export class ProjectUiStore {

    // Zooming view parameters.
    @observable public viewWidth: number;
    @observable public referenceViewStart: number;
    @observable public referenceViewPPS: number;
    @observable public currentTab: TabID;

    // Global cursor.
    @observable public referenceViewTimeCursor: number;

    // Current transition.
    private _referenceViewTransition: TransitionController;

    constructor() {
        // Initial setup.
        this.viewWidth = 800;
        this.referenceViewStart = 0;
        this.referenceViewPPS = 0.1;
        this._referenceViewTransition = null;
        this.referenceViewTimeCursor = null;
        this.currentTab = 'file';

        (projectStore.tracks as IObservableArray<Track>).observe(this.onTracksChanged.bind(this));

        // Listen to the track changed event from the alignmentLabelingStore.
        // alignmentLabelingStore.tracksChanged.on(this.onTracksChanged.bind(this));
        autorun('ProjectUiStore.onTracksChanged', () => this.onTracksChanged());
    }

    @action
    public switchTab(tab: TabID): void {
        this.currentTab = tab;
    }

    // On tracks changed, update zooming parameters so that the views don't overflow.
    public onTracksChanged(): void {
        if (projectStore.referenceTrack) {
            [this.referenceViewStart, this.referenceViewPPS] =
                this.constrainDetailedViewZoomingParameters(this.referenceViewStart, this.referenceViewPPS);
        }
    }

    // Return updated zooming parameters so that they don't exceed the reference track range.
    private constrainDetailedViewZoomingParameters(referenceViewStart: number, referenceViewPPS: number): [number, number] {
        if (!referenceViewStart) { referenceViewStart = this.referenceViewStart; }
        if (!referenceViewPPS) { referenceViewPPS = this.referenceViewPPS; }
        // Check if we go outside of the view, if yes, tune the parameters.
        if (projectStore) {
            referenceViewPPS = Math.max(
                this.viewWidth / (projectStore.referenceTimestampEnd - projectStore.referenceTimestampStart),
                referenceViewPPS);
            referenceViewStart = Math.max(
                projectStore.referenceTimestampStart,
                Math.min(projectStore.referenceTimestampEnd - this.viewWidth / referenceViewPPS, referenceViewStart));
        }
        return [referenceViewStart, referenceViewPPS];
    }


    // Exposed properties.
    // Detailed view zooming and translation.
    public get referenceViewDuration(): number { return this.viewWidth / this.referenceViewPPS; }
    public get referenceViewEnd(): number { return this.referenceViewStart + this.viewWidth / this.referenceViewPPS; }

    // Set the zooming parameters when a project is loaded.
    public setProjectReferenceViewZooming(referenceViewStart: number, referenceViewPPS: number): void {
        [referenceViewStart, referenceViewPPS] = this.constrainDetailedViewZoomingParameters(referenceViewStart, referenceViewPPS);
        this.referenceViewStart = referenceViewStart;
        this.referenceViewPPS = referenceViewPPS;
    }

    @action
    public setViewWidth(width: number): void {
        this.viewWidth = width;
        [this.referenceViewStart, this.referenceViewPPS] =
            this.constrainDetailedViewZoomingParameters(this.referenceViewStart, this.referenceViewPPS);
    }

    @action
    public setReferenceTrackPanZoom(referenceViewStart: number, referenceViewPPS: number = null, animate: boolean = false): void {
        if (!referenceViewStart) { referenceViewStart = this.referenceViewStart; }
        if (!referenceViewPPS) { referenceViewPPS = this.referenceViewPPS; }
        const [start, pps] =
            this.constrainDetailedViewZoomingParameters(referenceViewStart, referenceViewPPS);
        // Change current class to label's class.
        if (this.referenceViewStart !== start || this.referenceViewPPS !== pps) {
            if (!animate) {
                if (this._referenceViewTransition) {
                    this._referenceViewTransition.terminate();
                    this._referenceViewTransition = null;
                }
                this.referenceViewStart = start;
                this.referenceViewPPS = pps;
            } else {
                if (this._referenceViewTransition) {
                    this._referenceViewTransition.terminate();
                    this._referenceViewTransition = null;
                }
                const start0 = this.referenceViewStart;
                const zoom0 = this.referenceViewPPS;
                const start1 = start;
                const zoom1 = pps;
                this._referenceViewTransition = new TransitionController(
                    100, 'linear',
                    action('setReferenceTrackPanZoom animation', (t: number) => {
                        this.referenceViewStart = start0 + (start1 - start0) * t;
                        if (zoom1) {
                            this.referenceViewPPS = 1 / (1 / zoom0 + (1 / zoom1 - 1 / zoom0) * t);
                        }
                    }));
            }
        }
    }

    @action
    public referenceViewPanAndZoom(percentage: number, zoom: number, zoomCenter: 'cursor' | 'center' = 'cursor'): void {
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
            this.setReferenceTrackPanZoom(newStart, newPPS, false);
        }
        if (percentage !== 0) {
            const originalStart = this.referenceViewStart;
            const timeWidth = this.referenceViewDuration;
            this.setReferenceTrackPanZoom(originalStart + timeWidth * percentage, null, true);
        }
    }

    @action
    public setReferenceTrackTimeCursor(timeCursor: number): void {
        if (this.referenceViewTimeCursor !== timeCursor) {
            this.referenceViewTimeCursor = timeCursor;
        }
    }

}
