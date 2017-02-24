export function startDragging(
    move?: (e: MouseEvent) => void,
    up?: (e: MouseEvent) => void,
    useCapture: boolean = false): void {

    const handler_move = (event: MouseEvent) => {
        event.preventDefault();
        if (move) { move(event); }
    };
    const handler_up = (event: MouseEvent) => {
        window.removeEventListener('mousemove', handler_move, useCapture);
        window.removeEventListener('mouseup', handler_up, useCapture);
        if (up) { up(event); }
    };

    window.addEventListener('mousemove', handler_move, useCapture);
    window.addEventListener('mouseup', handler_up, useCapture);
}

export function isSameArray<T>(arr1?: T[], arr2?: T[]): boolean {
    return arr1 === arr2 || arr1 && arr2 && arr1.length === arr2.length && arr1.every((d, i) => d === arr2[i]);
}


export function makePathDFromPoints(points: number[][]): string {
    return 'M' + points.map(([x, y]) => x + ',' + y).join('L');
}

export class TransitionController {
    private _timer: number;
    private _onProgress: (t: number, finish?: boolean) => void;
    private _duration: number;

    private _timeStart: number;

    private onTick(): void {
        const fraction = (new Date().getTime() - this._timeStart) / this._duration;
        if (fraction > 1) {
            this.terminate();
        } else {
            if (this._onProgress) { this._onProgress(fraction, false); }
        }
    }

    public terminate(): void {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
            if (this._onProgress) { this._onProgress(1, true); }
        }
    }

    constructor(duration: number, easing: string, on_progress?: (fraction: number, finish?: boolean) => void) {
        this._timeStart = new Date().getTime();
        this._onProgress = on_progress;
        this._duration = duration;
        this._timer = setInterval(this.onTick.bind(this), 10);
    }
}

export class ArrayThrottler<ItemType, StationaryType> {
    private _minInterval: number;
    private _callback: (items: ItemType[], stationary: StationaryType) => void;
    private _stationary: StationaryType;
    private _queue: ItemType[];
    private _stationaryDirty: boolean;
    private _tLast: number;

    constructor(minInterval: number, callback: (items: ItemType[], stationary: StationaryType) => void) {
        this._minInterval = minInterval;
        this._callback = callback;
        this._queue = [];
        this._tLast = null;
        this._stationary = null;
        this._stationaryDirty = false;
    }

    public add(item: ItemType): void {
        this.addItems([item]);
    }

    public addItems(items: ItemType[]): void {
        if (items.length < 10) {
            items.forEach(x => this._queue.push(x));
        } else {
            this._queue = this._queue.concat(items);
        }
        this.start();
    }

    public setStationary(s: StationaryType): void {
        this._stationary = s;
        this._stationaryDirty = true;
        this.start();
    }

    private start(): void {
        if (this._queue.length > 0 || this._stationaryDirty) {
            const t = new Date().getTime();
            if (this._tLast === null || t - this._tLast > this._minInterval) {
                this._tLast = t;
                this._callback(this._queue, this._stationary);
                this._queue = [];
                this._stationaryDirty = false;
            } else {
                setTimeout(this.start.bind(this), this._minInterval - (t - this._tLast));
            }
        }
    }
}

