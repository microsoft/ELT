import { loadVideoTimeSeriesFromFile, VideoTimeSeries } from './dataset';
import * as child_process from 'child_process';
import * as path from 'path';

const ffmpegExe = 'ffmpeg/windows/ffmpeg.exe';

export function isWebm(filename: string): boolean {
    return path.extname(filename).toLocaleLowerCase() === '.webm';
}

function parseOutput(line: string): number/*seconds*/ {
    const match = /time=(\d\d):(\d\d):(\d\d).(\d\d)/.exec(line);
    if (match && match.length === 5) {
        return parseInt(match[1], 10) * 60 * 60 +
            parseInt(match[2], 10) * 60 +
            parseInt(match[3], 10) +
            parseInt(match[4], 10) / 100;
    }
    return null;
}

export function convertToWebm(
    filename: string, duration: number,
    progressCallback: (percentDone: number) => void,
    callback: (video: VideoTimeSeries) => void): void {

    const rootName = path.parse(filename).name;
    const outName = rootName + '.webm';
    const process = child_process.spawn(
        ffmpegExe, [
            '-y',               // force overwrite of existing file
            '-i', filename,
            '-g', '3',          // group of picture (GOP) size (fast seeking)
            '-c:v', 'vp8',      // WEBM codex
            '-crf', '10',       // quality mode
            '-b:v', '2000k',    // video bitrate
            '-an',              // disable audio
            outName]);
    process.stderr.addListener('data', chunk => {
        const lines = chunk.toString().split('\r');
        if (lines.length > 1) {
            const secondsConverted = parseOutput(lines[lines.length - 2]);
            if (secondsConverted) {
                const fractionDone = secondsConverted / duration;
                progressCallback(fractionDone);
            }
        }
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
