// An index to retrieve labels (or other range objects).

import {TimeRange} from './labeling';

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

export class TimeRangeIndex<TimeRangeType extends TimeRange> {
    private _ranges: Set<TimeRangeType>;

    constructor() {
        this._ranges = new Set<TimeRangeType>();
    }

    public add(range: TimeRangeType): void {
        this._ranges.add(range);
    }

    public addRanges(ranges: TimeRangeType[]): void {
        ranges.forEach((r) => this._ranges.add(r));
    }

    public remove(range: TimeRangeType): void {
        this._ranges.delete(range);
    }

    public clear(): void {
        this._ranges.clear();
    }

    public size(): number {
        return this._ranges.size;
    }

    public has(range: TimeRangeType): boolean {
        return this._ranges.has(range);
    }

    public forEach(callback: (range: TimeRangeType) => void): void {
        this._ranges.forEach(callback);
    }

    // Get all ranges in this index, return in arbitary order.
    public getRanges(): TimeRangeType[] {
        const ranges: TimeRangeType[] = [];
        this._ranges.forEach((r) => ranges.push(r));
        return ranges;
    }

    // Get all ranges that *overlaps* with [tmin, tmax], return them in order by timestampStart.
    public getRangesInRange(tmin: number, tmax: number): TimeRangeType[] {
        let ranges: TimeRangeType[] = [];
        this._ranges.forEach((r) => {
            if (r.timestampEnd >= tmin && r.timestampStart <= tmax) {
                ranges.push(r);
            }
        });
        ranges = ranges.sort((a, b) => a.timestampStart - b.timestampStart);
        return ranges;
    }

    // = getRangesInRange(tmin, tmax).length.
    public getNumberOfRangesInRange(tmin: number, tmax: number): number {
        return this.getRangesInRange(tmin, tmax).length;
    }

    // Get all ranges that *overlaps* with [tmin, tmax], whose overlap length is larger than margin. Return them in order by timestampStart.
    public getRangesWithMargin(tmin: number, tmax: number, margin: number): TimeRangeType[] {
        let ranges: TimeRangeType[] = this.getRangesInRange(tmin, tmax);
        ranges = ranges.filter((range) => {
            const oBegin = Math.max(range.timestampStart, tmin);
            const oEnd = Math.min(range.timestampEnd, tmax);
            return oEnd - oBegin > margin;
        });
        return ranges;
    }
}
