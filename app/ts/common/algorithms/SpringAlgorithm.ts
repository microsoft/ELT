/*
Implement the SPRING algorithm in the paper:

[1] Sakurai, Y., Faloutsos, C., & Yamamuro, M. (2007, April). 
Stream monitoring under the time warping distance. 
In 2007 IEEE 23rd International Conference on Data Engineering (pp. 1046-1055). IEEE.
*/

export class SpringAlgorithm<InputType, SampleType> {
    private _distanceFunction: (a: InputType, b: SampleType) => number;
    private _report: (dmin: number, ts: number, te: number) => void;
    private _input: InputType[];
    private _threshold: number;
    private _s: number[];
    private _d: number[];
    private _s2: number[];
    private _d2: number[];
    private _dmin: number;
    private _t: number;
    private _te: number;
    private _ts: number;
    private _margin: number; // How many samples of overlap do we allow.

    // Constructor:
    //  input: The label to search for.
    //  threshold: The threshold of reporting a match.
    //  distanceFunction: Compute the distance between two samples.
    //  report: Called once the algorithm finds something to report.
    constructor(
        input: InputType[],
        threshold: number,
        margin: number,
        distanceFunction: (a: InputType, b: SampleType) => number,
        report: (dmin: number, ts: number, te: number) => void) {

        this._distanceFunction = distanceFunction;
        this._report = report;
        this._input = input;
        this._margin = margin;
        this._threshold = threshold;
        this._s = [];
        this._d = [];
        this._s2 = [];
        this._d2 = [];
        for (let i = 1; i <= this._input.length; i++) {
            this._d[i] = 1e10;
            this._s[i] = 0;
        }
        this._dmin = 1e10;
        this._t = 0;
        this._ts = 0;
        this._te = 0;
    }

    // Process a new sample.
    // If a match is found, callback will be called with the indices of the starting and ending samples (zero-based).
    public feed(xt: SampleType): void {
        const t = this._t + 1;
        const m = this._input.length;
        const d: number[] = this._d2;
        const s: number[] = this._s2;
        d[0] = 0;
        s[0] = t;
        for (let i = 1; i <= m; i++) {
            const dist = this._distanceFunction(this._input[i - 1], xt);
            const d_i_minus_1 = d[i - 1];
            const d_i_p = this._d[i];
            const d_i_p_minus_1 = this._d[i - 1];
            if (d_i_minus_1 <= d_i_p && d_i_minus_1 <= d_i_p_minus_1) {
                d[i] = dist + d_i_minus_1;
                s[i] = s[i - 1];
            } else if (d_i_p <= d_i_minus_1 && d_i_p <= d_i_p_minus_1) {
                d[i] = dist + d_i_p;
                s[i] = this._s[i];
            } else {
                d[i] = dist + d_i_p_minus_1;
                s[i] = this._s[i - 1];
            }
        }

        if (this._dmin <= this._threshold) {
            let condition = true;
            for (let i = 0; i <= m; i++) {
                if (!(d[i] >= this._dmin || s[i] > this._te - this._margin)) {
                    condition = false;
                }
            }
            if (condition) {
                this._report(this._dmin, this._ts - 1, this._te - 1);
                this._dmin = 1e10;
                for (let i = 1; i <= m; i++) {
                    if (s[i] <= this._te - this._margin) {
                        d[i] = 1e10;
                    }
                }
            }
        }

        if (d[m] <= this._threshold && d[m] < this._dmin) {
            this._dmin = d[m];
            this._ts = s[m];
            this._te = t;
        }

        this._d2 = this._d; this._d = d;
        this._s2 = this._s; this._s = s;
        this._t = t;
    }
}


export class SpringAlgorithmCore<InputType, SampleType> {
    private _distanceFunction: (a: InputType, b: SampleType) => number;
    private _input: InputType[];
    private _s: number[];
    private _d: number[];
    private _s2: number[];
    private _d2: number[];
    private _t: number;

    // Constructor:
    //  input: The label to search for.
    //  threshold: The threshold of reporting a match.
    //  distanceFunction: Compute the distance between two samples.
    //  report: Called once the algorithm finds something to report.
    constructor(input: InputType[], distanceFunction: (a: InputType, b: SampleType) => number) {
        this._distanceFunction = distanceFunction;
        this._input = input;
        this._s = [];
        this._d = [];
        this._s2 = [];
        this._d2 = [];
        for (let i = 1; i <= this._input.length; i++) {
            this._d[i] = 1e10;
            this._s[i] = 0;
        }
        this._t = 0;
    }

    // Process a new sample.
    // If a match is found, callback will be called with the indices of the starting and ending samples (zero-based).
    public feed(xt: SampleType): void {
        const t = this._t + 1;
        const m = this._input.length;
        const d: number[] = this._d2;
        const s: number[] = this._s2;
        d[0] = 0;
        s[0] = t;
        for (let i = 1; i <= m; i++) {
            const dist = this._distanceFunction(this._input[i - 1], xt);
            const d_i_minus_1 = d[i - 1];
            const d_i_p = this._d[i];
            const d_i_p_minus_1 = this._d[i - 1];
            if (d_i_minus_1 <= d_i_p && d_i_minus_1 <= d_i_p_minus_1) {
                d[i] = dist + d_i_minus_1;
                s[i] = s[i - 1];
            } else if (d_i_p <= d_i_minus_1 && d_i_p <= d_i_p_minus_1) {
                d[i] = dist + d_i_p;
                s[i] = this._s[i];
            } else {
                d[i] = dist + d_i_p_minus_1;
                s[i] = this._s[i - 1];
            }
        }

        this._d2 = this._d; this._d = d;
        this._s2 = this._s; this._s = s;
        this._t = t;
    }

    public get d(): number[] {
        return this._d;
    }
    public get t(): number {
        return this._t;
    }
    public get s(): number[] {
        return this._s;
    }
}

export class MultipleSpringAlgorithm<InputType, SampleType> {
    private _cores: SpringAlgorithmCore<InputType, SampleType>[];
    private _M: number[];
    private _report: (which: number, dmin: number, ts: number, te: number) => void;
    private _thresholdScales: number[];
    private _lengthRanges: number[][];
    private _margin: number;

    private _dmin: number;
    private _whichMin: number;
    private _ts: number;
    private _te: number;

    constructor(
        inputs: InputType[][],
        thresholdScales: number[],
        lengthRanges: number[][],
        margin: number,
        distanceFunction: (a: InputType, b: SampleType) => number,
        report: (which: number, dmin: number, ts: number, te: number) => void
    ) {
        this._cores = inputs.map((input) => new SpringAlgorithmCore(input, distanceFunction));
        this._M = inputs.map((input) => input.length);
        this._thresholdScales = thresholdScales;
        this._lengthRanges = lengthRanges;
        this._margin = margin;
        this._report = report;
        this._dmin = 1e10;
        this._ts = 0;
        this._te = 0;
    }

    public feed(xt: SampleType): [number, number] {
        this._cores.forEach((core) => core.feed(xt));

        const t = this._cores[0].t;
        const ds = this._cores.map((core) => core.d);
        const ss = this._cores.map((core) => core.s);


        if (this._dmin <= 1) {
            let condition = true;
            for (let i = 0; i < this._cores.length; i++) {
                const m = this._M[i];
                for (let j = 0; j <= m; j++) {
                    if (!(ds[i][j] / this._thresholdScales[i] >= this._dmin || ss[i][j] > this._te - this._margin)) {
                        condition = false;
                        break;
                    }
                    if (!condition) { break; }
                }
            }
            if (condition) {
                this._report(this._whichMin, this._dmin * this._thresholdScales[this._whichMin], this._ts - 1, this._te - 1);
                this._dmin = 1e10;
                for (let i = 0; i < this._cores.length; i++) {
                    const m = this._M[i];
                    for (let j = 1; j <= m; j++) {
                        if (ss[i][j] <= this._te - this._margin) {
                            ds[i][j] = 1e10;
                        }
                    }
                }
            }
        }

        // Find the minimum d and s.
        let minI = null; let minD = null; let minS = null;
        for (let i = 0; i < this._cores.length; i++) {
            const d = ds[i][this._M[i]] / this._thresholdScales[i];
            const s = ss[i][this._M[i]];
            // Is the length acceptable?
            if (t - s >= this._lengthRanges[i][0] && t - s <= this._lengthRanges[i][1]) {
                if (minI === null || d < minD) {
                    minI = i;
                    minD = d;
                    minS = s;
                }
            }
        }
        if (minI !== null && minD <= 1 && minD < this._dmin) {
            this._dmin = minD;
            this._whichMin = minI;
            this._ts = minS;
            this._te = t;
        }

        if (minI !== null) {
            return [minI, minD * this._thresholdScales[minI]];
        } else {
            return [null, null];
        }
    }
}

export class MultipleSpringAlgorithmBestMatch<InputType, SampleType> {
    private _cores: SpringAlgorithmCore<InputType, SampleType>[];
    private _M: number[];
    private _thresholdScales: number[];

    private _dmin: number;
    private _whichMin: number;
    private _ts: number;
    private _te: number;

    constructor(
        inputs: InputType[][],
        thresholdScales: number[],
        distanceFunction: (a: InputType, b: SampleType) => number
    ) {
        this._cores = inputs.map((input) => new SpringAlgorithmCore(input, distanceFunction));
        this._M = inputs.map((input) => input.length);
        this._thresholdScales = thresholdScales;
        this._dmin = null;
        this._whichMin = null;
        this._ts = null;
        this._te = null;
    }

    public feed(xt: SampleType): void {
        this._cores.forEach((core) => core.feed(xt));

        const t = this._cores[0].t;
        const ds = this._cores.map((core) => core.d);
        const ss = this._cores.map((core) => core.s);

        // Find the minimum d and s.
        let minI = null; let minD = null; let minS = null;
        for (let i = 0; i < this._cores.length; i++) {
            const d = ds[i][this._M[i]] / this._thresholdScales[i];
            const s = ss[i][this._M[i]];
            // Is the length acceptable?
            if (minI === null || d < minD) {
                minI = i;
                minD = d;
                minS = s;
            }
        }
        if (minD !== null && (this._dmin === null || minD < this._dmin)) {
            this._dmin = minD;
            this._whichMin = minI;
            this._ts = minS;
            this._te = t;
        }
    }

    public getBestMatch(): [number, number, number, number] {
        if (this._whichMin === null) { return [null, null, null, null]; }
        return [this._whichMin, this._dmin * this._thresholdScales[this._whichMin], this._ts - 1, this._te - 1];
    }
}
