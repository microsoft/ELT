import {Dataset, SensorTimeSeries, TimeSeriesKind} from './dataset';

export function resampleColumn(
    input: number[] | Float32Array,
    t0: number,
    t1: number,
    out_t0: number,
    out_t1: number,
    length: number): Float32Array {

    const result = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        const t = i / (length - 1) * (out_t1 - out_t0) + out_t0;
        const in_pos = (t - t0) / (t1 - t0) * (input.length - 1);
        let in_i0 = Math.floor(in_pos);
        let in_i1 = in_i0 + 1;
        const d = in_pos - in_i0;
        in_i0 = Math.max(0, Math.min(in_i0, input.length - 1));
        in_i1 = Math.max(0, Math.min(in_i1, input.length - 1));
        result[i] = input[in_i0] * (1 - d) + input[in_i1] * d;
    }
    // Fill-in NaNs.
    let previousNonNan = 0;
    for (let i = 0; i < length; i++) {
        if (result[i] !== result[i]) {
            result[i] = previousNonNan;
        } else {
            previousNonNan = result[i];
        }
    }
    return result;
}

export function resampleDatasetRowMajorOne(dataset: Dataset, index: number, t0: number, t1: number, length: number): Float32Array {
    const resampled = resampleDataset(dataset, t0, t1, length);
    return resampled[index];
}

export function resampleDatasetRowMajorAverage(dataset: Dataset, t0: number, t1: number, length: number): number[] {
    const resampled = resampleDatasetRowMajor(dataset, t0, t1, length);
    return resampled.map(row => {
        let s = 0;
        for (let i = 0; i < row.length; i++) { s += row[i]; }
        return s / row.length;
    });
}

export function resampleDatasetRowMajor(dataset: Dataset, t0: number, t1: number, length: number): number[][] {
    const resampled = resampleDataset(dataset, t0, t1, length);
    const resampledArray: number[][] = [];
    for (let i = 0; i < length; i++) {
        resampledArray[i] = resampled.map(y => y[i]);
    }
    return resampledArray;
}

function resampleDataset(dataset: Dataset, t0: number, t1: number, length: number): Float32Array[] {
    const data: Float32Array[] = [];
    const sensors = dataset.timeSeries.filter(ts => ts.kind !== TimeSeriesKind.VIDEO) as SensorTimeSeries[];
    sensors.forEach(sensor => {
        sensor.dimensions.forEach(dim => {
            data.push(resampleColumn(dim, sensor.timestampStart, sensor.timestampEnd, t0, t1, length));
        });
    });
    return data;
}
