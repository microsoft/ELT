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

    public equals(that: PanZoomParameters): boolean {
        return this.rangeStart === that.rangeStart &&
            this.pixelsPerSecond === that.pixelsPerSecond;
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

    public interpolate(that: PanZoomParameters, fraction: number): PanZoomParameters {
        return new PanZoomParameters(
            this.rangeStart + (that.rangeStart - this.rangeStart) * fraction,
            this.pixelsPerSecond + (that.pixelsPerSecond - this.pixelsPerSecond) * fraction);
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
        const target = this.referencePanZoom.constrain(referenceViewStart, referenceViewPPS);
        if (this.referencePanZoom.equals(target)) { return; }
        if (animate) {
            if (this._referenceViewTransition) {
                this._referenceViewTransition.terminate();
                this._referenceViewTransition = null;
            }
            const original = this.referencePanZoom;
            this._referenceViewTransition = new TransitionController(
                100, 'linear',
                action('setReferenceTrackPanZoom animation', (fraction: number) => {
                    this.referencePanZoom = original.interpolate(target, fraction);
                }));
        } else {
            if (this._referenceViewTransition) {
                this._referenceViewTransition.terminate();
                this._referenceViewTransition = null;
            }
            this.referencePanZoom = target;
        }
    }

    @action
    public zoomReferenceTrack(zoom: number, zoomCenter: 'cursor' | 'center'): void {
        if (zoom === 0) { throw 'bad zoom'; }
        const original = this.referencePanZoom;
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

    @action
    public zoomReferenceTrackByPercentage(percentage: number): void {
        const original = this.referencePanZoom;
        const timeWidth = this.referenceViewDuration;
        this.setReferenceTrackPanZoom(original.rangeStart + timeWidth * percentage, null, true);
    }

    @action
    public setReferenceTrackTimeCursor(timeCursor: number): void {
        if (this.referenceViewTimeCursor !== timeCursor) {
            this.referenceViewTimeCursor = timeCursor;
        }
    }

}
