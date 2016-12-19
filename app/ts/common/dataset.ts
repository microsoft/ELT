import * as d3 from 'd3';
import { readFileSync } from 'fs';
import * as fs from 'fs';

// Types of input timeseries.
// Do not change already assigned numbers.
export enum TimeSeriesKind {
    TEMPERATURE = 1,
    PRESSURE = 2,
    BUTTON = 3,
    GYROSCOPE = 4,
    ACCELEROMETER = 5,
    MAGNETOMETER = 6,
    VIDEO = 100,
    RAW = 7
}


export enum AlignedState {
    ALIGNED = 1,
    NOT_ALIGNED = 2,
    IN_PROCESS = 3
}


// Base class of all timeseries.
// To make serialization easier, Timeseries should be plain objects.
export interface TimeSeries {
    kind: TimeSeriesKind;
    name: string;
    timestampStart: number;
    timestampEnd: number;
    aligned?: AlignedState;
}

// Just loads the raw data from file (used for exporting labels, i.e., annotating the original data)
export interface RawTimeSeries extends TimeSeries {
    timeColumn: number[];
    rawData: string[][];
}

// Single/multi-variate timeseries.
export interface SensorTimeSeries extends TimeSeries {
    sampleRate: number;     // sample rate in Hz.
    dimensions: (number[] | Float32Array)[]; // dimensions[0] = [x0, x1, x2, ...], dimensions[1] = [y0, y1, y2, ...]
    scales: number[][];     // scales[0] = [ xmin, xmax ]
}


// Video.
export interface VideoTimeSeries extends TimeSeries {
    filename: string;       // video path
    width: number;          // width of the video.
    height: number;         // height of the video.
    videoDuration: number;  // duration of the video (in seconds, don't confuse with timestampStart and timestampEnd).
    // duration not necessarily equal to timestampEnd - timestampStart because of scaling.
}


interface SerializedData {
    timeSeries: TimeSeries[];
    timestampStart: number;
    timestampEnd: number;
    name: string;
}


// Dataset, essentially a set of timeseries aligned to a global time.
export class Dataset {
    public timeSeries: TimeSeries[] = [];
    public timestampStart: number;
    public timestampEnd: number;
    public name: string = 'dataset';

    public addSensor(series: SensorTimeSeries): void {
        this.timeSeries.push(series);
    }

    public addVideo(series: VideoTimeSeries): void {
        this.timeSeries.push(series);
    }

    public serialize(): Object {
        return {
            timeSeries: this.timeSeries,
            timestampStart: this.timestampStart,
            timestampEnd: this.timestampEnd,
            name: this.name
        };
    }

    public deserialize(serialized: Object): void {
        const data = serialized as SerializedData;
        this.timeSeries = data.timeSeries;
        this.timestampStart = data.timestampStart;
        this.timestampEnd = data.timestampEnd;
        this.name = data.name;
    }

    public serializeToFile(filename: string): void {
        const obj: Object = this.serialize();
        fs.writeFileSync(filename, JSON.stringify(obj));
    }

    public deserializeFromFile(filename: string): void {
        const obj: Object = JSON.parse(fs.readFileSync(filename).toString());
        this.deserialize(obj);
    }
}



function getVideoMetadata(filename: string, callback: (width: number, height: number, duration: number) => void): void {
    const element = document.createElement('video');
    element.onloadedmetadata = () => {
        callback(element.videoWidth, element.videoHeight, element.duration);
    };
    element.src = filename;
}


export function loadVideoTimeSeriesFromFile(filename: string, callback: (video: VideoTimeSeries) => void): void {
    getVideoMetadata(filename, (width: number, height: number, duration: number) => {
        const vts: VideoTimeSeries = {
            timestampStart: 0,
            timestampEnd: duration,
            width: width,
            height: height,
            videoDuration: duration,
            filename: filename,
            kind: TimeSeriesKind.VIDEO,
            name: filename
        };
        callback(vts);
    });
}


// FIXME: what's the difference between this and loadMultipleSensorTimeSeriesFromFile?
// This function reads Liang's sensor data format.
export function loadSensorTimeSeriesFromFile(filename: string): SensorTimeSeries {
    const content = readFileSync(filename, 'utf-8');
    const rows = d3.tsvParseRows(content)
        .filter((x) => x.length > 0 && x.join('').length > 0);
    const numColumns = rows[0].length;
    const columns: number[][] = [];
    const isColumnValid: boolean[] = [];
    for (let i = 0; i < numColumns; i++) {
        const column: number[] = [];
        let valid = false;
        for (let j = 0; j < rows.length; j++) {
            const val = +rows[j][i];
            column[j] = val;
            if (val === val) { valid = true; }
        }
        columns[i] = column;
        isColumnValid[i] = valid;
    }
    const timeColumn = columns[0]; // time are in milliseconds, these are converted to seconds in the following code.

    if (isColumnValid[1] && isColumnValid[2] && isColumnValid[3]) {
        const X = columns[1];
        const Y = columns[2];
        const Z = columns[3];
        const min = d3.min([d3.min(X), d3.min(Y), d3.min(Z)]);
        const max = d3.max([d3.max(X), d3.max(Y), d3.max(Z)]);
        const scale = [min, max];
        return {
            name: filename,
            kind: TimeSeriesKind.ACCELEROMETER,
            timestampStart: timeColumn[0] / 1000,
            timestampEnd: timeColumn[timeColumn.length - 1] / 1000,
            sampleRate: (timeColumn[timeColumn.length - 1] - timeColumn[0]) / 1000 / (timeColumn.length - 1),
            dimensions: [X, Y, Z],
            scales: [scale, scale, scale],
            aligned: 0
        };
    }
    if (isColumnValid[7] && isColumnValid[8] && isColumnValid[9]) {
        const X = columns[7];
        const Y = columns[8];
        const Z = columns[9];
        const min = d3.min([d3.min(X), d3.min(Y), d3.min(Z)]);
        const max = d3.max([d3.max(X), d3.max(Y), d3.max(Z)]);
        const scale = [min, max];
        return {
            name: filename,
            kind: TimeSeriesKind.GYROSCOPE,
            timestampStart: timeColumn[0] / 1000,
            timestampEnd: timeColumn[timeColumn.length - 1] / 1000,
            sampleRate: (timeColumn[timeColumn.length - 1] - timeColumn[0]) / 1000 / (timeColumn.length - 1),
            dimensions: [X, Y, Z],
            scales: [scale, scale, scale],
            aligned: 0
        };
    }
    return null;
}


// This function reads multiple sensor data from Liang's sensor data format.
export function loadMultipleSensorTimeSeriesFromFile(filename: string): SensorTimeSeries[] {
    const content = readFileSync(filename, 'utf-8');
    const rows = d3.tsvParseRows(content)
        .filter((x) => x.length > 0 && x.join('').length > 0);
    const numColumns = rows[0].length;
    const columns: number[][] = [];
    const isColumnValid: boolean[] = [];
    for (let i = 0; i < numColumns; i++) {
        const column: number[] = [];
        let valid = false;
        for (let j = 0; j < rows.length; j++) {
            let val = parseFloat(rows[j][i]);

            if (val !== val) {
                if (j !== 0 && j !== rows.length - 1) {
                    // set missing rows to average of prev and next to preserve sample rate
                    val = (parseFloat(rows[j - 1][i]) + parseFloat(rows[j + 1][i])) / 2;
                }
            }

            column[j] = val;
            if (val === val) { valid = true; }
        }
        columns[i] = column;
        isColumnValid[i] = valid;
    }
    const timeColumn = columns[0]; // time are in milliseconds, these are converted to seconds in the following code.
    const result: SensorTimeSeries[] = [];
    if (isColumnValid[1] && isColumnValid[2] && isColumnValid[3]) {
        const X = columns[1];
        const Y = columns[2];
        const Z = columns[3];
        const min = d3.min([d3.min(X), d3.min(Y), d3.min(Z)]);
        const max = d3.max([d3.max(X), d3.max(Y), d3.max(Z)]);
        const scale = [min, max];
        result.push({
            name: filename + '.Accelerometer',
            kind: TimeSeriesKind.ACCELEROMETER,
            timestampStart: timeColumn[0] / 1000,
            timestampEnd: timeColumn[timeColumn.length - 1] / 1000,
            sampleRate: (timeColumn[timeColumn.length - 1] - timeColumn[0]) / 1000 / (timeColumn.length - 1),
            dimensions: [X, Y, Z],
            scales: [scale, scale, scale],
            aligned: 0
        });
    }
    if (isColumnValid[7] && isColumnValid[8] && isColumnValid[9]) {
        const X = columns[7];
        const Y = columns[8];
        const Z = columns[9];
        const min = d3.min([d3.min(X), d3.min(Y), d3.min(Z)]);
        const max = d3.max([d3.max(X), d3.max(Y), d3.max(Z)]);
        const scale = [min, max];
        result.push({
            name: filename + '.Gyroscope',
            kind: TimeSeriesKind.GYROSCOPE,
            timestampStart: timeColumn[0] / 1000,
            timestampEnd: timeColumn[timeColumn.length - 1] / 1000,
            sampleRate: (timeColumn[timeColumn.length - 1] - timeColumn[0]) / 1000 / (timeColumn.length - 1),
            dimensions: [X, Y, Z],
            scales: [scale, scale, scale],
            aligned: 0
        });
    }
    return result;
}

export function loadRawSensorTimeSeriesFromFile(filename: string): RawTimeSeries {
    const content = readFileSync(filename, 'utf-8');
    let rows = d3.tsvParseRows(content);
    rows = rows.filter((x) => x.length > 0 && x.join('').length > 0);
    const numColumns = rows[0].length;
    const columns: number[][] = [];
    for (let i = 0; i < numColumns; i++) {
        const column: number[] = [];
        for (let j = 0; j < rows.length; j++) {
            let val = parseFloat(rows[j][i]);
            if (val !== val) {
                if (j !== 0 && j !== rows.length - 1) {
                    // set missing rows to average of prev and next to preserve sample rate
                    val = (parseFloat(rows[j - 1][i]) + parseFloat(rows[j + 1][i])) / 2;
                }
            }
            column[j] = val;
        }
        columns[i] = column;
    }
    const timeColumn = columns[0]; // time are in milliseconds, these are converted to seconds in the following code.
    return {
        name: filename + '.Raw',
        kind: TimeSeriesKind.RAW,
        timestampStart: timeColumn[0] / 1000,
        timestampEnd: timeColumn[timeColumn.length - 1] / 1000,
        timeColumn: timeColumn,
        rawData: rows
    };
}
