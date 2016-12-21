// Do suggestions with the Spring DTW algorithm.

import { DBA } from '../../common/algorithms/DBA';
import { MultipleSpringAlgorithm, MultipleSpringAlgorithmBestMatch } from '../../common/algorithms/SpringAlgorithm';
import { Label, LabelConfirmationState, resampleDatasetRowMajor } from '../../common/common';
import { Dataset } from '../../common/dataset';
import { generateArduinoCodeForDtwModel, generateMicrobitCodeForDtwModel } from '../DtwDeployment';
import { LabelingSuggestionCallback, LabelingSuggestionModel } from '../LabelingSuggestionEngine';



interface ReferenceLabel {
    series: number[][];
    variance: number;
    className: string;
    adjustmentsBegin: number;
    adjustmentsEnd: number;
}


// We use the sum of absolute distance as distance function, rather than euclidean distance
function distanceFunction(a: number[], b: number[]): number {
    let s = 0;
    const dim = a.length;
    for (let i = 0; i < dim; i++) { s += Math.abs(a[i] - b[i]); }
    return s;
}


function averageFunction(x: number[][]): number[] {
    const mean = x[0].slice();
    const N = x.length;
    for (let i = 1; i < N; i++) {
        for (let j = 0; j < mean.length; j++) {
            mean[j] += x[i][j];
        }
    }
    for (let j = 0; j < mean.length; j++) {
        mean[j] /= N;
    }
    return mean;
}



function groupBy<InputType>(input: InputType[], groupFunc: (itype: InputType) => string): { group: string, items: InputType[] }[] {
    const groupName2Items: { [name: string]: InputType[] } = {};
    input.forEach((inp) => {
        const group = groupFunc(inp);
        if (groupName2Items[group]) {
            groupName2Items[group].push(inp);
        } else {
            groupName2Items[group] = [inp];
        }
    });
    const result: { group: string, items: InputType[] }[] = [];
    Object.keys(groupName2Items).forEach(group => {
        result.push({
            group: group,
            items: groupName2Items[group]
        });
    });
    return result;
}



function getAverageLabelsPerClass(
    dataset: Dataset,
    labels: Label[],
    sampleRate: number): ReferenceLabel[] {

    if (!labels || labels.length === 0) {
        return [];
    }

    const dba = new DBA<number[]>(distanceFunction, averageFunction);

    const classes_array = groupBy(
        labels.map(reference => ({
            name: reference.className,
            timestampStart: reference.timestampStart,
            timestampEnd: reference.timestampEnd,
            samples: resampleDatasetRowMajor(
                dataset,
                reference.timestampStart, reference.timestampEnd,
                Math.round(sampleRate * (reference.timestampEnd - reference.timestampStart))
            )
        })),
        input => input.name);

    const result: ReferenceLabel[] = [];

    for (const { group, items } of classes_array) {
        const means = dba.computeKMeans(items.map((x) => x.samples), 1, 10, 10, 0.01);

        const errors1: number[] = [];
        const errors2: number[] = [];

        items.forEach((item) => {
            const itemDuration = item.timestampEnd - item.timestampStart;
            const margin = 0.1 * itemDuration;
            const samplesWithMargin = resampleDatasetRowMajor(
                dataset,
                item.timestampStart - margin, item.timestampEnd + margin,
                Math.round(sampleRate * (item.timestampEnd - item.timestampStart + margin * 2))
            );
            const sampleIndex2Time = (index) => {
                return index / (samplesWithMargin.length - 1) * (item.timestampEnd - item.timestampStart + margin * 2) +
                    (item.timestampStart - margin);
            };

            const spring = new MultipleSpringAlgorithmBestMatch<number[], number[]>(
                means.map((x) => x.mean),
                means.map((x) => x.variance),
                distanceFunction
            );
            samplesWithMargin.forEach((x) => spring.feed(x));

            const [which, , ts, te] = spring.getBestMatch();
            if (which !== null) {
                const t1 = sampleIndex2Time(ts);
                const t2 = sampleIndex2Time(te);
                if (Math.abs(t1 - item.timestampStart) < margin && Math.abs(t2 - item.timestampEnd) < margin) {
                    errors1.push(t1 - item.timestampStart);
                    errors2.push(t2 - item.timestampEnd);
                }
            }
        });

        const off1 = errors1.length > 0 ? errors1.reduce((a, b) => a + b, 0) / errors1.length : 0;
        const off2 = errors2.length > 0 ? errors2.reduce((a, b) => a + b, 0) / errors2.length : 0;

        // console.log(off1, off2);

        for (const { mean, variance } of means) {
            result.push({
                className: group,
                variance: variance,
                adjustmentsBegin: off1,
                adjustmentsEnd: off2,
                series: mean
            });
        }
    }

    return result;
}



class DtwSuggestionModel extends LabelingSuggestionModel {
    private _references: ReferenceLabel[];
    private _sampleRate: number;
    private _callback2Timer: WeakMap<LabelingSuggestionCallback, NodeJS.Timer>;
    private _allTimers: Set<NodeJS.Timer>;

    constructor(references: ReferenceLabel[], sampleRate: number) {
        super();
        this._references = references;
        this._sampleRate = sampleRate;
        this._callback2Timer = new WeakMap<LabelingSuggestionCallback, NodeJS.Timer>();
        this._allTimers = new Set<NodeJS.Timer>();
    }

    public getDeploymentCode(platform: string, callback: (code: string) => any): void {
        if (platform === 'arduino') {
            callback(generateArduinoCodeForDtwModel(this._sampleRate, 30, this._references));
        }
        if (platform === 'microbit') {
            callback(generateMicrobitCodeForDtwModel(this._sampleRate, 30, this._references));
        }
    }

    // Compute suggestions in the background.
    // Calling computeSuggestion should cancel the one currently running.
    // Callback will be called multiple times, the last one should have completed set to true OR error not null.
    public computeSuggestion(
        dataset: Dataset,
        timestampStart: number,
        timestampEnd: number,
        confidenceThreshold: number,
        generation: number,
        callback: LabelingSuggestionCallback): void {

        timestampStart = Math.round(this._sampleRate * timestampStart) / this._sampleRate;
        timestampEnd = Math.round(this._sampleRate * timestampEnd) / this._sampleRate;

        let labels = this._references;
        labels = labels.filter((x) => x.variance !== null);
        if (labels.length === 0) {
            callback(
                [],
                {
                    timestampCompleted: timestampEnd,
                    timestampStart: timestampStart,
                    timestampEnd: timestampEnd,
                    generation: generation
                },
                true);
            return;
        }

        const resampledLength = Math.round(this._sampleRate * (timestampEnd - timestampStart));

        const confidenceHistogram = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

        const getLikelihood = (variance: number, distance: number) => {
            // return 1 - invertGaussianPercentPoint(-distance / variance) * 2;
            return Math.exp(-distance * distance / variance / variance / 2);
        };
        const thresholds = labels.map((label) => {
            return Math.sqrt(-2 * Math.log(confidenceThreshold)) * label.variance;
        });

        let labelCache: Label[] = [];

        const algo = new MultipleSpringAlgorithm<number[], number[]>(
            labels.map((label) => label.series),
            thresholds,
            labels.map((label) => [label.series.length * 0.8, label.series.length * 1.2]),
            10,
            distanceFunction,
            (which, dist, ts, te) => {
                const label = labels[which];
                let t1 = ts / (resampledLength - 1) * (timestampEnd - timestampStart) + timestampStart;
                let t2 = te / (resampledLength - 1) * (timestampEnd - timestampStart) + timestampStart;
                t1 -= labels[which].adjustmentsBegin;
                t2 -= labels[which].adjustmentsEnd;
                const likelihood = getLikelihood(label.variance, dist);
                // console.log(likelihood, dist, thresholds[which], label.variance);
                labelCache.push({
                    timestampStart: t1,
                    timestampEnd: t2,
                    className: label.className,
                    state: LabelConfirmationState.UNCONFIRMED,
                    suggestionConfidence: likelihood,
                    suggestionGeneration: generation
                });
            }
        );

        let iCurrent = 0;
        const doNextChunk = () => {
            const chunkSize = Math.ceil(100 / labels.length);
            labelCache = [];

            // Subsample and normalize the data.
            const tChunkStart = iCurrent / (resampledLength - 1) * (timestampEnd - timestampStart) + timestampStart;
            const tChunkEnd = (iCurrent + chunkSize - 1) / (resampledLength - 1) * (timestampEnd - timestampStart) + timestampStart;
            const chunkSamples = resampleDatasetRowMajor(dataset, tChunkStart, tChunkEnd, chunkSize);

            // Feed data into the SPRING algorithm.
            for (const s of chunkSamples) {
                const [minI, minD] = algo.feed(s);
                if (minD !== null) {
                    const cf = getLikelihood(labels[minI].variance, minD);
                    const histIndex = Math.floor(Math.pow(cf, 0.3) * (confidenceHistogram.length - 1));
                    if (histIndex >= 0 && histIndex < confidenceHistogram.length) {
                        confidenceHistogram[histIndex] += 1;
                    }
                }
            }

            // Call user's callback.
            callback(
                labelCache,
                {
                    timestampStart: timestampStart,
                    timestampEnd: timestampEnd,
                    timestampCompleted: (iCurrent + chunkSize) / (resampledLength - 1) * (timestampEnd - timestampStart) + timestampStart,
                    generation: generation,
                    confidenceHistogram: confidenceHistogram
                },
                false);
            // Clear the cache after user callback.
            labelCache = [];

            // Determine the next chunk.
            if (iCurrent + chunkSize < resampledLength) {
                iCurrent += chunkSize;
                const timer = setTimeout(doNextChunk, 1);
                this._callback2Timer.set(callback, timer);
                this._allTimers.add(timer);
            } else {
                callback(
                    [],
                    {
                        timestampStart: timestampStart,
                        timestampEnd: timestampEnd,
                        timestampCompleted: timestampEnd,
                        generation: generation,
                        confidenceHistogram: confidenceHistogram
                    },
                    true);
            }
        };

        const timer = setTimeout(doNextChunk, 1);
        this._callback2Timer.set(callback, timer);
        this._allTimers.add(timer);
    }

    public cancelSuggestion(callback: LabelingSuggestionCallback): void {
        if (this._callback2Timer.has(callback)) {
            clearTimeout(this._callback2Timer.get(callback));
            this._allTimers.delete(this._callback2Timer.get(callback));
            this._callback2Timer.delete(callback);
        }
    }

    public dispose(): void {
        this._allTimers.forEach((x) => clearTimeout(x));
    }
}


export module DtwAlgorithm {

    export function createModel(dataset: Dataset, labels: Label[]): DtwSuggestionModel {
        const maxDuration = labels.map((label) => label.timestampEnd - label.timestampStart).reduce((a, b) => Math.max(a, b), 0);
        const sampleRate = 100 / maxDuration; // / referenceDuration;
        const references = getAverageLabelsPerClass(dataset, labels, sampleRate);
        return new DtwSuggestionModel(references, sampleRate);
    }

    export function getReferenceLabels(dataset: Dataset, labels: Label[]): ReferenceLabel[] {
        const maxDuration = labels
            .map(label => label.timestampEnd - label.timestampStart)
            .reduce((a, b) => Math.max(a, b), 0);
        const sampleRate = 100 / maxDuration; // / referenceDuration;
        return getAverageLabelsPerClass(dataset, labels, sampleRate);
    }
}
