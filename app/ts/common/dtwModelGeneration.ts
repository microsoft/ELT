import * as ell from 'emll';
// Generate DTW code for Arduino and Microbit.
import { resampleColumn } from '../common/common';
export interface ReferenceLabel {
    series: number[][];
    variance: number;
    className: string;
}
export function makeVector(l: number[]): ell.DoubleVector;
export function makeVector(l: number[][]): ell.DoubleVectorVector;
export function makeVector(l): any {
    if (typeof l === 'object' && typeof (l[0]) === 'number') {
        let result1 = new ell.DoubleVector();
        for (let x of l) {
            result1.add(x);
        }
        return result1;
    } else if (typeof l === 'object' && typeof (l[0]) === 'object') {
        let result2 = new ell.DoubleVectorVector();
        for (let row of l) {
            result2.add(makeVector(row));
        }
        return result2;
    }
}
export function generateEMLLPrototypes(sampleRate: number, arduinoSampleRate: number, references: ReferenceLabel[]) {
    let currentIndex = 1;
    let maxLength = 0;
    let labels: { [name: string]: number; } = {};
    let prototypes = new ell.PrototypeList();
    for (let ref of references) {
        let label;
        if (ref.className in labels) {
            label = labels[ref.className];
        } else {
            label = currentIndex;
            labels[ref.className] = label;
            currentIndex += 1;
        }
        let dim = ref.series[0].length;
        let length = Math.ceil(ref.series.length / sampleRate * arduinoSampleRate);
        maxLength = Math.max(length, maxLength);
        let dimensions: Float32Array[] = [];
        for (let i = 0; i < dim; i++) {
            dimensions.push(resampleColumn(ref.series.map((x) => x[i]), 0, 1, 0, 1, length));
        }
        let newSamples: number[][] = [];
        for (let i = 0; i < length; i++) {
            let newRow = [];
            for (let j = 0; j < dim; j++) {
                newRow.push(dimensions[j][i]);
            }
            newSamples.push(newRow);
        }
        let variance = ref.variance / ref.series.length * length;
        let prototype = new ell.ELL_LabeledPrototype(label, makeVector(newSamples), variance);
        prototypes.add(prototype);
    }
    return prototypes;
}
export function generateEMLLModel(sampleRate: number, arduinoSampleRate: number, references: ReferenceLabel[], confidenceThreshold: number) {
    let prototypes = generateEMLLPrototypes(sampleRate, arduinoSampleRate, references);
    let model: ell.ELL_CompiledMap = ell.GenerateMulticlassDTWClassifier(prototypes, confidenceThreshold);
    // let model:EMLL.ELL_CompiledMap = EMLL.GenerateDtwDistanceModel(prototypes.get(0));    
    return model;
}
