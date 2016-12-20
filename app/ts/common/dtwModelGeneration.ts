import { resampleColumn } from '../common/common';
import * as ell from 'emll';

// Generate DTW code for Arduino and Microbit.


export interface ReferenceLabel {
    series: number[][];
    variance: number;
    className: string;
}
export function makeVector(l: number[]): ell.DoubleVector;
export function makeVector(l: number[][]): ell.DoubleVectorVector;
export function makeVector(l: any): any {
    if (typeof l === 'object' && typeof (l[0]) === 'number') {
        const result1 = new ell.DoubleVector();
        for (const x of l) {
            result1.add(x);
        }
        return result1;
    } else if (typeof l === 'object' && typeof (l[0]) === 'object') {
        const result2 = new ell.DoubleVectorVector();
        for (const row of l) {
            result2.add(makeVector(row));
        }
        return result2;
    }
}



export function generateEMLLPrototypes(
    sampleRate: number,
    arduinoSampleRate: number,
    references: ReferenceLabel[]): ell.PrototypeList {

    let currentIndex = 1;
    let maxLength = 0;
    const labels: { [name: string]: number; } = {};
    const prototypes = new ell.PrototypeList();
    for (const ref of references) {
        let label;
        if (ref.className in labels) {
            label = labels[ref.className];
        } else {
            label = currentIndex;
            labels[ref.className] = label;
            currentIndex += 1;
        }
        const dim = ref.series[0].length;
        const length = Math.ceil(ref.series.length / sampleRate * arduinoSampleRate);
        maxLength = Math.max(length, maxLength);
        const dimensions: Float32Array[] = [];
        for (let i = 0; i < dim; i++) {
            dimensions.push(resampleColumn(ref.series.map((x) => x[i]), 0, 1, 0, 1, length));
        }
        const newSamples: number[][] = [];
        for (let i = 0; i < length; i++) {
            const newRow = [];
            for (let j = 0; j < dim; j++) {
                newRow.push(dimensions[j][i]);
            }
            newSamples.push(newRow);
        }
        const variance = ref.variance / ref.series.length * length;
        const prototype = new ell.ELL_LabeledPrototype(label, makeVector(newSamples), variance);
        prototypes.add(prototype);
    }
    return prototypes;
}



export function generateEMLLModel(
    sampleRate: number,
    arduinoSampleRate: number,
    references: ReferenceLabel[],
    confidenceThreshold: number): ell.ELL_CompiledMap {

    const prototypes = generateEMLLPrototypes(sampleRate, arduinoSampleRate, references);
    return ell.GenerateMulticlassDTWClassifier(prototypes, confidenceThreshold);
}
