// An index to retrieve labels (or other range objects).

import { TimeRange } from './labeling';
import { ObservableSet } from './ObservableSet';
import { action } from 'mobx';



export class TimeRangeIndex<TimeRangeType extends TimeRange> extends ObservableSet<TimeRangeType> {

    constructor() {
        super(tr => tr.timestampStart + '-' + tr.timestampEnd);
    }

    @action public addRanges(ranges: TimeRangeType[]): void {
        ranges.forEach(r => this.add(r));
    }

    // Get all ranges that *overlaps* with [tmin, tmax], return them in order by timestampStart.
    public getRangesInRange(tmin: number, tmax: number): TimeRangeType[] {
        return this.items
            .filter(r => r.timestampEnd >= tmin && r.timestampStart <= tmax)
            .sort((a, b) => a.timestampStart - b.timestampStart);
    }

    // Get all ranges that *overlaps* with [tmin, tmax], whose overlap length is larger than margin. Return them in order by timestampStart.
    public getRangesWithinMargin(tmin: number, tmax: number, margin: number): TimeRangeType[] {
        return this.getRangesInRange(tmin, tmax)
            .filter(range => {
                const oBegin = Math.max(range.timestampStart, tmin);
                const oEnd = Math.min(range.timestampEnd, tmax);
                return oEnd - oBegin > margin;
            });
    }
}



export function mergeTimeRangeArrays<TimeRangeType extends TimeRange>(arr1: TimeRangeType[], arr2: TimeRangeType[]): TimeRangeType[] {
    let i1 = 0;
    let i2 = 0;
    const result: TimeRangeType[] = [];
    while (i1 < arr1.length || i2 < arr2.length) {
        if (i1 >= arr1.length) {
            result.push(arr2[i2++]);
        } else if (i2 >= arr2.length) {
            result.push(arr1[i1++]);
        } else if (arr1[i1].timestampStart < arr2[i2].timestampStart) {
            result.push(arr1[i1++]);
        } else {
            result.push(arr2[i2++]);
        }
    }
    return result;
}
