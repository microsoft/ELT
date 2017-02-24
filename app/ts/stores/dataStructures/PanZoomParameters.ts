import { TimeRange } from './labeling';
import { observable } from 'mobx';


export class PanZoomParameters {
    @observable public rangeStart: number;
    @observable public pixelsPerSecond: number;

    constructor(rangeStart: number, pixelsPerSecond: number) {
        this.rangeStart = rangeStart;
        this.pixelsPerSecond = pixelsPerSecond;
    }

    public equals(that: PanZoomParameters): boolean {
        return this.rangeStart === that.rangeStart &&
            this.pixelsPerSecond === that.pixelsPerSecond;
    }

    public constrain(target: PanZoomParameters, viewWidth: number, timeRange: TimeRange): PanZoomParameters {
        let rangeStart = target.rangeStart || this.rangeStart;
        let pixelsPerSecond = target.pixelsPerSecond || this.pixelsPerSecond;
        // Check if we go outside of the view, if yes, tune the parameters.
        pixelsPerSecond = Math.max(pixelsPerSecond, viewWidth / (timeRange.timestampEnd - timeRange.timestampStart));
        rangeStart = Math.max(
            timeRange.timestampStart,
            Math.min(timeRange.timestampEnd - viewWidth / pixelsPerSecond, rangeStart));
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


