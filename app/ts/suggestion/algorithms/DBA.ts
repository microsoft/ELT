import {RC4} from './RC4';


/*
Implements the DBA algorithm in:

[1] Petitjean, F., Ketterlin, A., & Gançarski, P. (2011). 
A global averaging method for dynamic time warping, with applications to clustering. 
Pattern Recognition, 44(3), 678-693.

[2] Petitjean, F., Forestier, G., Webb, G. I., Nicholson, A. E., Chen, Y., & Keogh, E. (2014, December). 
Dynamic time warping averaging of time series allows faster and more accurate classification. 
In 2014 IEEE International Conference on Data Mining (pp. 470-479). IEEE.
*/


export class DBA<SampleType> {
    private _currentAverage: SampleType[];
    private _series: SampleType[][];
    private _distanceFunction: (a: SampleType, b: SampleType) => number;
    private _meanFunction: (x: SampleType[]) => SampleType;

    constructor(distanceFunction: (a: SampleType, b: SampleType) => number, meanFunction: (x: SampleType[]) => SampleType) {
        this._distanceFunction = distanceFunction;
        this._meanFunction = meanFunction;
        this._currentAverage = [];
        this._series = [];
    }

    // Compute DTW between two series, return [ cost, [ [ i, j ], ... ] ].
    public dynamicTimeWarp(a: SampleType[], b: SampleType[]): [number, [number, number][]] {
        const matrix: [number, number][][] = [];
        for (let i = 0; i <= a.length; i++) {
            matrix[i] = [];
            for (let j = 0; j <= b.length; j++) {
                matrix[i][j] = [1e20, 0];
            }
        }
        matrix[0][0] = [0, 0];
        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                const cost = this._distanceFunction(a[i - 1], b[j - 1]);
                const c1 = matrix[i - 1][j][0];
                const c2 = matrix[i][j - 1][0];
                const c3 = matrix[i - 1][j - 1][0];
                if (c1 <= c2 && c1 <= c3) {
                    matrix[i][j] = [cost + c1, 1];
                } else if (c2 <= c1 && c2 <= c3) {
                    matrix[i][j] = [cost + c2, 2];
                } else {
                    matrix[i][j] = [cost + c3, 3];
                }
            }
        }
        const result: [number, number][] = [];
        let i = a.length; let j = b.length;
        while (i > 0 && j > 0) {
            const s = matrix[i][j][1];
            result.push([i - 1, j - 1]);
            if (s === 1) { i -= 1; }
            if (s === 2) { j -= 1; }
            if (s === 3) { i -= 1; j -= 1; }
        }
        result.reverse();
        return [matrix[a.length][b.length][0], result];
    }

    // Init the DBA algorithm with series.
    public init(series: SampleType[][]): void {
        this._series = series;

        // Initialize the average series naively to the first sereis.
        // TODO: Implement better initialization methods, see [1] for more detail.
        this._currentAverage = series[0];
    }

    // Do one DBA iteration, return the average amount of update (in the distanceFunction).
    // Usually 5-10 iterations is sufficient to get a good average series.
    // You can also test if the returned value (the average update distance of this iteration) 
    // is sufficiently small to determine convergence.
    public iterate(): number {
        const s = this._currentAverage;
        const alignments: SampleType[][] = [];
        for (let i = 0; i < s.length; i++) { alignments[i] = []; }
        for (const series of this._series) {
            const [, match] = this.dynamicTimeWarp(s, series);
            for (const [i, j] of match) {
                alignments[i].push(series[j]);
            }
        }
        this._currentAverage = alignments.map(this._meanFunction);
        return s.map((k, i) =>
            this._distanceFunction(k, this._currentAverage[i])).reduce((a, b) => a + b, 0) / s.length;
    }

    // Get the current average series.
    public get average(): SampleType[] {
        return this._currentAverage;
    }

    public computeAverage(series: SampleType[][], iterations: number, TOL: number): SampleType[] {
        this.init(series);
        for (let i = 0; i < iterations; i++) {
            const change = this.iterate();
            if (change < TOL) { break; }
        }
        return this.average;
    }

    public computeVariance(series: SampleType[][], center: SampleType[]): number {
        if (series.length < 3) { return null; }
        const distances = series.map((s) => this.dynamicTimeWarp(s, center)[0]);
        let sumsq = 0;
        for (const d of distances) { sumsq += d * d; }
        return Math.sqrt(sumsq / (distances.length - 1));
    }

    public computeKMeans(
        series: SampleType[][],
        k: number,
        kMeansIterations: number = 10,
        abcIterations: number = 10,
        dbaTolerance: number = 0.001): { variance: number, mean: SampleType[] }[] {
        if (k > series.length) {
            return series.map(s => ({ variance: 0, mean: s }));
        }
        if (k === 1) {
            const mean = this.computeAverage(series, abcIterations, dbaTolerance);
            return [{ variance: this.computeVariance(series, mean), mean }];
        }
        const random = new RC4('Labeling');
        const maxIterations = kMeansIterations;

        const assignSeriesToCenters = (centers: SampleType[][]) => {
            const classSeries: SampleType[][][] = [];
            for (let i = 0; i < k; i++) { classSeries[i] = []; }
            for (const s of series) {
                let minD = null; let minI = null;
                for (let i = 0; i < k; i++) {
                    const d = this.dynamicTimeWarp(centers[i], s)[0];
                    if (minI === null || d < minD) {
                        minI = i;
                        minD = d;
                    }
                }
                classSeries[minI].push(s);
            }
            return classSeries;
        };

        const currentCenters = random.choose(series.length, k).map((i) => series[i]);
        let assigned = assignSeriesToCenters(currentCenters);

        // KMeans iterations.
        for (let iteration = 0; iteration < maxIterations; iteration++) {
            // Update means.
            for (let i = 0; i < k; i++) {
                currentCenters[i] = this.computeAverage(assigned[i], abcIterations, dbaTolerance);
            }
            assigned = assignSeriesToCenters(currentCenters);
        }
        return currentCenters.map((center, i) => ({
            variance: this.computeVariance(assigned[i], center),
            mean: center
        })
        );
    }
}
