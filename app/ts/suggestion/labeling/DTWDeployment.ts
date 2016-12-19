// Generate DTW code for Arduino and Microbit.
import {resampleColumn} from '../../common/common';
import * as eletron from 'electron';
import * as fs from 'fs';
import * as path from 'path';



const templateArduino = readTemplate('dtwArduino.txt');
const templateMicrobit = readTemplate('dtwMicrobit.txt');

function readTemplate(filename: string): string {
    const rootDir = eletron.remote.getGlobal('rootDir');
    const fullname = path.join(rootDir, 'app', 'templates', 'dtw', filename);
    return fs.readFileSync(fullname).toString();
}


export interface ReferenceLabel {
    series: number[][];
    variance: number;
    className: string;
}

export function generateArduinoCodeForDtwModel(sampleRate: number, arduinoSampleRate: number, references: ReferenceLabel[]): string {
    let index = 1;
    const lines = [];
    const setupLines = [];
    const matchLines = [];
    const resetLines = [];
    const matchComparisonLines = [];
    for (const ref of references) {
        const dim = ref.series[0].length;
        const name = 'classPrototype' + index.toString();
        const length = Math.ceil(ref.series.length / sampleRate * arduinoSampleRate);
        const dimensions: Float32Array[] = [];
        for (let i = 0; i < dim; i++) {
            dimensions.push(resampleColumn(ref.series.map((x) => x[i]), 0, 1, 0, 1, length));
        }
        const newSamples = [];
        for (let i = 0; i < length; i++) {
            for (let j = 0; j < dim; j++) {
                newSamples.push(dimensions[j][i]);
            }
        }
        lines.push(`float ${name}_samples[] = { ${newSamples.join(', ')} };`);
        lines.push(`int ${name}_dim = ${dim};`);
        lines.push(`int ${name}_length = ${length};`);
        lines.push(`float ${name}_variance = ${ref.variance / ref.series.length * length};`);
        lines.push(`struct DTWInfo ${name}_DTW;`);

        setupLines.push(`DTWInit(&${name}_DTW, ${dim}, ${name}_samples, ${name}_length, ${name}_variance * threshold);`);
        resetLines.push(`DTWReset(&${name}_DTW);`);

        matchLines.push(`DTWFeed(&${name}_DTW, sample);`);
        matchComparisonLines.push(`if(${name}_DTW.bestMatchEndsAtTDistance < 1 && minClassScore > ${name}_DTW.bestMatchEndsAtTDistance) {`);
        matchComparisonLines.push(`    minClass = '${ref.className}';`);
        matchComparisonLines.push(`    minClassScore = ${name}_DTW.bestMatchEndsAtTDistance;`);
        matchComparisonLines.push('}');

        index += 1;
    }
    matchComparisonLines.push('if(minClassScore < 1) {');
    matchComparisonLines.push('    resetRecognizer();');
    matchComparisonLines.push('}');

    return templateArduino
        .replace('%%GLOBAL%%', lines.join('\n'))
        .replace('%%SETUP%%', setupLines.map((x) => '    ' + x).join('\n'))
        .replace('%%RESET%%', resetLines.map((x) => '    ' + x).join('\n'))
        .replace('%%MATCH%%', matchLines.map((x) => '    ' + x).join('\n'))
        .replace('%%MATCH_COMPARISON%%', matchComparisonLines.map((x) => '    ' + x).join('\n'))
        ;
}


export function generateMicrobitCodeForDtwModel(sampleRate: number, arduinoSampleRate: number, references: ReferenceLabel[]): string {
    let index = 1;
    const lines = [];
    const setupLines = [];
    const matchLines = [];
    const matchComparisonLines = [];
    let maxLength = 0;
    for (const ref of references) {
        const dim = ref.series[0].length;
        const name = 'classPrototype' + index.toString();
        const length = Math.ceil(ref.series.length / sampleRate * arduinoSampleRate);
        maxLength = Math.max(length, maxLength);
        const dimensions: Float32Array[] = [];
        for (let i = 0; i < dim; i++) {
            dimensions.push(resampleColumn(ref.series.map((x) => x[i]), 0, 1, 0, 1, length));
        }
        const newSamples = [];
        for (let i = 0; i < length; i++) {
            for (let j = 0; j < dim; j++) {
                newSamples.push(dimensions[j][i]);
            }
        }
        lines.push(`let ${name}_samples = [ ${newSamples.map(Math.round).join(', ')} ];`);
        lines.push(`let ${name}_dim = ${dim};`);
        lines.push(`let ${name}_length = ${length};`);
        lines.push(`let ${name}_variance = ${ref.variance / ref.series.length * length};`);
        lines.push(`let ${name}_DTW: DTWInfo = null;`);

        setupLines.push(`${name}_DTW = new DTWInfo(${dim}, ${name}_samples, ${name}_length, ${name}_variance * threshold / 1000000);`);

        matchLines.push(`${name}_DTW.feed(sample);`);
        matchComparisonLines.push(
            `if(${name}_DTW.bestMatchEndsAtTDistance < 1000 && minClassScore > ${name}_DTW.bestMatchEndsAtTDistance) {`);
        matchComparisonLines.push(`    minClass = '${ref.className}';`);
        matchComparisonLines.push(`    minClassScore = ${name}_DTW.bestMatchEndsAtTDistance;`);
        matchComparisonLines.push('}');

        index += 1;
    }
    const initialArray: number[] = [];
    for (let i = 0; i < maxLength + 1; i++) { initialArray[i] = 0; }

    return templateMicrobit
        .replace('%%ARRAY_INITIALIZATION%%', '[ ' + initialArray.join(', ') + ' ]')
        .replace('%%ARRAY_INITIALIZATION%%', '[ ' + initialArray.join(', ') + ' ]')
        .replace('%%GLOBAL%%', lines.join('\n'))
        .replace('%%SETUP%%', setupLines.map((x) => '    ' + x).join('\n'))
        .replace('%%MATCH%%', matchLines.map((x) => '    ' + x).join('\n'))
        .replace('%%MATCH_COMPARISON%%', matchComparisonLines.map((x) => '    ' + x).join('\n'))
        ;
}
