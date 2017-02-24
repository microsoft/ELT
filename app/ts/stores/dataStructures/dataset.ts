import * as d3 from 'd3';
import { readFileSync } from 'fs';
import * as fs from 'fs';

// Types of input time series.
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


// Base class of all timeseries.
// To make serialization easier, Timeseries should be plain objects.
export interface TimeSeries {
    kind: TimeSeriesKind;
    name: string;
    timestampStart: number;
    timestampEnd: number;
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
        callback({
            timestampStart: 0,
            timestampEnd: duration,
            width: width,
            height: height,
            videoDuration: duration,
            filename: filename,
            kind: TimeSeriesKind.VIDEO,
            name: filename
        });
    });
}


// This function reads multiple sensor data from Liang's sensor data format.
export function loadMultipleSensorTimeSeriesFromFile(filename: string): SensorTimeSeries[] {
    const content = readFileSync(filename, 'utf-8');
    const rows = d3.tsvParseRows(content)
        .filter(x => x.length > 0 && x.join('').length > 0);
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
    const timeSeriesList: SensorTimeSeries[] = [];
    for (let c = 1; c < columns.length; c++) {
        if (!isColumnValid[c]) { continue; }
        timeSeriesList.push({
            name: filename + '.col' + c,
            kind: TimeSeriesKind.ACCELEROMETER,
            timestampStart: timeColumn[0] / 1000,
            timestampEnd: timeColumn[timeColumn.length - 1] / 1000,
            sampleRate: (timeColumn[timeColumn.length - 1] - timeColumn[0]) / 1000 / (timeColumn.length - 1),
            dimensions: [columns[c]],
            scales: [[d3.min(columns[c]), d3.max(columns[c])]]
        });
    }
    return timeSeriesList;
}

export function loadRawSensorTimeSeriesFromFile(filename: string): RawTimeSeries {
    const content = readFileSync(filename, 'utf-8');
    let rows = d3.tsvParseRows(content);
    rows = rows.filter(x => x.length > 0 && x.join('').length > 0);
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
