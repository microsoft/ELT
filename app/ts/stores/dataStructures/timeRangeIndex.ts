// An index to retrieve labels (or other range objects).

import { TimeRange } from './labeling';
import { ObservableSet } from './ObservableSet';
import { action, computed, observable } from 'mobx';



export class TimeRangeIndex<TimeRangeType extends TimeRange> extends ObservableSet<TimeRangeType> {

    constructor() {
        super(tr => tr.timestampStart + '-' + tr.timestampEnd);
    }

    @action public addRanges(ranges: TimeRangeType[]): void {
        ranges.forEach((r) => this.add(r));
    }

    // Get all ranges that *overlaps* with [tmin, tmax], return them in order by timestampStart.
    public getRangesInRange(tmin: number, tmax: number): TimeRangeType[] {
        return this.items
            .filter(r => r.timestampEnd >= tmin && r.timestampStart <= tmax)
            .sort((a, b) => a.timestampStart - b.timestampStart);
    }

    // Get all ranges that *overlaps* with [tmin, tmax], whose overlap length is larger than margin. Return them in order by timestampStart.
    public getRangesWithMargin(tmin: number, tmax: number, margin: number): TimeRangeType[] {
        return this.getRangesInRange(tmin, tmax)
            .filter(range => {
                const oBegin = Math.max(range.timestampStart, tmin);
                const oEnd = Math.min(range.timestampEnd, tmax);
                return oEnd - oBegin > margin;
            });
    }
}
