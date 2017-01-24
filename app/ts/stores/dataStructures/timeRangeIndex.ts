// An index to retrieve labels (or other range objects).

import { TimeRange } from './labeling';
import { ObservableSet } from './ObservableSet';
import { action, computed, observable } from 'mobx';



export class TimeRangeIndex<TimeRangeType extends TimeRange> {
    @observable private _ranges: ObservableSet<TimeRangeType>;

    constructor() {
        this._ranges = new ObservableSet<TimeRangeType>(
            tr => tr.timestampStart + '-' + tr.timestampEnd
        );
    }

    @action public add(range: TimeRangeType): void {
        this._ranges.add(range);
    }

    @action public addRanges(ranges: TimeRangeType[]): void {
        ranges.forEach((r) => this._ranges.add(r));
    }

    @action public remove(range: TimeRangeType): void {
        this._ranges.remove(range);
    }

    @action public clear(): void {
        this._ranges.clear();
    }

    @computed public get size(): number {
        return this._ranges.size;
    }

    public has(range: TimeRangeType): boolean {
        return this._ranges.has(range);
    }

    public forEach(callback: (range: TimeRangeType) => void): void {
        this._ranges.forEach(callback);
    }

    // Get all ranges in this index, return in arbitary order.
    @computed public get ranges(): TimeRangeType[] {
        return this._ranges.items;
    }

    // Get all ranges that *overlaps* with [tmin, tmax], return them in order by timestampStart.
    public getRangesInRange(tmin: number, tmax: number): TimeRangeType[] {
        return this.ranges
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
