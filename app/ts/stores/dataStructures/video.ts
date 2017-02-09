import { loadVideoTimeSeriesFromFile, VideoTimeSeries } from './dataset';
import * as child_process from 'child_process';
import * as path from 'path';

const ffmpegExe = '/ffmpeg/ffmpeg.exe';

export function isWebm(filename: string): boolean {
    return path.extname(filename) === '.wemb';
}

export function convertToWebm(filename: string, callback: (video: VideoTimeSeries) => void): void {
    const rootName = path.parse(filename).name;
    const outName = rootName + '.webm';
    const process = child_process.spawn(ffmpegExe, ['-i', filename, outName]);
    process.stdout.addListener('data', chunk => {
        console.log(chunk);
    });
    process.stderr.addListener('data', chunk => {
        console.log(chunk);
    });
    process.addListener('exit', code => {
        if (code === 0) {
            loadVideoTimeSeriesFromFile(outName, callback);
        }
    });
}

export function fadeBackground(filename: string): void {
    throw 'not implemented';
}
