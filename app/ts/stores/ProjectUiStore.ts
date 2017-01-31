import { Track } from './dataStructures/alignment';
import { TimeRange } from './dataStructures/labeling';
import { TabID } from './dataStructures/types';
import { ProjectStore } from './ProjectStore';
import { projectStore, projectUiStore } from './stores';
import { TransitionController } from './utils';
import { action, autorun, IObservableArray, observable } from 'mobx';

export class PanZoomParameters {
    public readonly rangeStart: number;
    public readonly pixelsPerSecond: number;

    constructor(rangeStart: number, pixelsPerSecond: number) {
        this.rangeStart = rangeStart;
        this.pixelsPerSecond = pixelsPerSecond;
    }

    public constrain(rangeStart?: number, pixelsPerSecond?: number): PanZoomParameters {
        rangeStart = rangeStart || this.rangeStart;
        pixelsPerSecond = pixelsPerSecond || this.pixelsPerSecond;
        // Check if we go outside of the view, if yes, tune the parameters.
        if (projectStore) {
            pixelsPerSecond = Math.max(pixelsPerSecond, projectUiStore.viewWidth / projectStore.referenceTimeDuration);
            rangeStart = Math.max(
                projectStore.referenceTimestampStart,
                Math.min(projectStore.referenceTimestampEnd - projectUiStore.viewWidth / pixelsPerSecond, rangeStart));
        }
        return new PanZoomParameters(rangeStart, pixelsPerSecond);
    }

    public getTimeFromX(x: number): number {
        return x / this.pixelsPerSecond + this.rangeStart;
    }

    public getTimeRangeToX(x: number): TimeRange {
        return { timestampStart: this.rangeStart, timestampEnd: this.getTimeFromX(x) };
    }

}




export class ProjectUiStore {

    @observable public viewWidth: number;
    @observable public referencePanZoom: PanZoomParameters;
    @observable public currentTab: TabID;
    @observable public referenceViewTimeCursor: number;

    // Current transition.
    private _referenceViewTransition: TransitionController;

    constructor(projectStore: ProjectStore) {
        // Initial setup.
        this.viewWidth = 800;
        this.referencePanZoom = new PanZoomParameters(0, 0.1);
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
            this.referencePanZoom = this.referencePanZoom.constrain();
        }
    }

    // Return updated zooming parameters so that they don't exceed the reference track range.


    // Exposed properties.
    // Detailed view zooming and translation.
    public get referenceViewDuration(): number {
        return this.viewWidth / this.referencePanZoom.pixelsPerSecond;
    }
    public get referenceTimeRange(): TimeRange {
        return {
            timestampStart: this.referencePanZoom.rangeStart,
            timestampEnd: this.referencePanZoom.getTimeFromX(this.viewWidth)
        };
    }

    // Set the zooming parameters when a project is loaded.
    public setProjectReferenceViewZooming(referenceViewStart: number, referenceViewPPS: number): void {
        this.referencePanZoom = this.referencePanZoom.constrain(referenceViewStart, referenceViewPPS);
    }

    @action
    public setViewWidth(width: number): void {
        this.viewWidth = width;
        this.referencePanZoom = this.referencePanZoom.constrain();
    }

    @action
    public setReferenceTrackPanZoom(referenceViewStart: number, referenceViewPPS: number = null, animate: boolean = false): void {
        const panZoom = this.referencePanZoom.constrain(referenceViewStart, referenceViewPPS);
        // Change current class to label's class.
        if (this.referencePanZoom.rangeStart !== panZoom.rangeStart ||
            this.referencePanZoom.pixelsPerSecond !== panZoom.pixelsPerSecond) {
            if (!animate) {
                if (this._referenceViewTransition) {
                    this._referenceViewTransition.terminate();
                    this._referenceViewTransition = null;
                }
                this.referencePanZoom = panZoom;
            } else {
                if (this._referenceViewTransition) {
                    this._referenceViewTransition.terminate();
                    this._referenceViewTransition = null;
                }
                const panZoom0 = this.referencePanZoom;
                this._referenceViewTransition = new TransitionController(
                    100, 'linear',
                    action('setReferenceTrackPanZoom animation', (t: number) => {
                        this.referencePanZoom = new PanZoomParameters(
                            panZoom0.rangeStart + (panZoom.rangeStart - panZoom0.rangeStart) * t,
                            1 / (1 / panZoom0.pixelsPerSecond + (1 / panZoom.pixelsPerSecond - 1 / panZoom0.pixelsPerSecond) * t));
                    }));
            }
        }
    }

    @action
    public referenceViewPanAndZoom(percentage: number, zoom: number, zoomCenter: 'cursor' | 'center' = 'cursor'): void {
        const original = this.referencePanZoom;
        if (zoom !== 0) {
            const k = Math.exp(-zoom);
            // Two rules to compute new zooming.
            // 1. Time cursor should be preserved: (time_cursor - old_start) * old_pps = (time_cursor - new_start) * new_pps
            // 2. Zoom factor should be applied: new_start = k * old_start
            let timeCursor = this.referencePanZoom.rangeStart + this.referenceViewDuration / 2;
            if (zoomCenter === 'cursor') { timeCursor = this.referenceViewTimeCursor; }
            const newPPS = original.pixelsPerSecond * k;
            const newStart = original.rangeStart / k + timeCursor * (1 - 1 / k);
            this.setReferenceTrackPanZoom(newStart, newPPS, false);
        }
        if (percentage !== 0) {
            const timeWidth = this.referenceViewDuration;
            this.setReferenceTrackPanZoom(original.rangeStart + timeWidth * percentage, null, true);
        }
    }

    @action
    public setReferenceTrackTimeCursor(timeCursor: number): void {
        if (this.referenceViewTimeCursor !== timeCursor) {
            this.referenceViewTimeCursor = timeCursor;
        }
    }

}
