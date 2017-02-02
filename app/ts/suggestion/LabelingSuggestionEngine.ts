// Suggestion model classes and suggestion engine.

import { Dataset } from '../stores/dataStructures/dataset';
import { Label } from '../stores/dataStructures/labeling';
import * as stores from '../stores/stores';
import { LabelingSuggestionCallback, LabelingSuggestionModel, LabelingSuggestionProgress } from './LabelingSuggestionModel';
import { DtwAlgorithm } from './worker/DtwAlgorithm';
import { EventEmitter } from 'events';


export abstract class LabelingSuggestionModelBuilder {
    public abstract buildModelAsync(
        dataset: Dataset,
        labels: Label[],
        callback: (model: LabelingSuggestionModel, progress: number, error: string) => void): void;
}


interface LabelingSuggestionCallbackInfo {
    callback: LabelingSuggestionCallback;
    model: LabelingSuggestionModel;
    parameters: {
        timestampStart: number,
        timestampEnd: number,
        confidenceThreshold: number,
        callback: LabelingSuggestionCallback,
        generation: number
    };
}


// Manages the life-cycle of suggestion models and run suggestions with the newest built model.
export class LabelingSuggestionEngine extends EventEmitter {
    private _dataset: Dataset;
    private _labels: Label[];
    private _modelBuilder: LabelingSuggestionModelBuilder;
    private _currentModel: LabelingSuggestionModel;
    private _computingInstances: Map<LabelingSuggestionCallback, LabelingSuggestionCallbackInfo>;
    private _shouldRebuildModel: boolean;
    private _isRebuildingModel: boolean;
    private _onModelBuiltCallbackQueue: ((model: LabelingSuggestionModel) => void)[];

    constructor(modelBuilder: LabelingSuggestionModelBuilder) {
        super();
        this._dataset = null;
        this._labels = [];
        this._modelBuilder = modelBuilder;
        this._currentModel = null;
        this._computingInstances = new Map<LabelingSuggestionCallback, LabelingSuggestionCallbackInfo>();
        this._shouldRebuildModel = true;
        this._isRebuildingModel = false;
        this._onModelBuiltCallbackQueue = [];
    }

    public setDataset(dataset: Dataset): void {
        this._dataset = dataset;
        this._shouldRebuildModel = true;
        this.rebuildModel();
    }

    public setLabels(labels: Label[]): void {
        this._labels = labels;
        this._shouldRebuildModel = true;
        this.rebuildModel();
    }

    public setDatasetAndLabels(dataset: Dataset, labels: Label[]): void {
        this._dataset = dataset;
        this._labels = labels;
        this._shouldRebuildModel = true;
        this.rebuildModel();
    }

    public getDeploymentCode(platform: string, callback: (code: string) => any): void {
        if (this._currentModel) {
            this._currentModel.getDeploymentCode(platform, callback);
        } else {
            callback('// Model unavailabel right now. Please go to labeling and turn on suggestions.');
        }
    }

    private storeModel(dataset: Dataset, labels: Label[]): void {
        const maxDuration = labels
            .map(label => label.timestampEnd - label.timestampStart)
            .reduce((a, b) => Math.max(a, b), 0);
        const sampleRate = 100 / maxDuration; // / referenceDuration;
        stores.dtwModelStore.prototypes = DtwAlgorithm.getReferenceLabels(dataset, labels);
        stores.dtwModelStore.prototypeSampleRate = sampleRate;
    }

    private rebuildModel(): void {
        if (this._shouldRebuildModel && this._dataset && !this._isRebuildingModel) {
            this._isRebuildingModel = true;
            this._shouldRebuildModel = false;

            this.storeModel(this._dataset, this._labels);

            this._modelBuilder.buildModelAsync(
                this._dataset, this._labels,
                (model, progress, error) => {
                    if (model) {
                        const restartInfos: LabelingSuggestionCallbackInfo[] = [];
                        if (this._currentModel && this._currentModel !== model) {
                            this._computingInstances.forEach((info, callback) => {
                                this._currentModel.cancelSuggestion(callback);
                                restartInfos.push(info);
                            });
                            this._currentModel.dispose();
                        }
                        this._currentModel = model;
                        this._isRebuildingModel = false;

                        this._onModelBuiltCallbackQueue.forEach(callback => callback(model));
                        this._onModelBuiltCallbackQueue = [];

                        // Restart any existing calculation.
                        restartInfos.forEach(info => {
                            this.computeSuggestion(
                                info.parameters.timestampStart,
                                info.parameters.timestampEnd,
                                info.parameters.confidenceThreshold,
                                info.parameters.generation,
                                info.parameters.callback);
                        });

                        this.rebuildModel();
                    }
                });
        }
    }

    // Compute suggestions in the background.
    // Calling computeSuggestion should cancel the one currently running.
    // Callback will be called multiple times, the last one should have completed set to true OR error not null.
    public computeSuggestion(
        timestampStart: number,
        timestampEnd: number,
        confidenceThreshold: number,
        generation: number,
        callback: LabelingSuggestionCallback): void {

        const cbProxy: LabelingSuggestionCallback = (labels: Label[], progress: LabelingSuggestionProgress, completed: boolean) => {
            if (completed) {
                this._computingInstances.delete(callback);
            }
            callback(labels, progress, completed);
        };
        const cbInfo = {
            callback: cbProxy,
            parameters: {
                timestampStart: timestampStart,
                timestampEnd: timestampEnd,
                confidenceThreshold: confidenceThreshold,
                callback: callback,
                generation: generation
            },
            model: this._currentModel
        };
        this._computingInstances.set(callback, cbInfo);

        if (!this._currentModel) {
            this._onModelBuiltCallbackQueue.push(model => {
                if (this._computingInstances.has(callback)) {
                    cbInfo.model = model;
                    model.computeSuggestion(this._dataset, timestampStart, timestampEnd, confidenceThreshold, generation, cbProxy);
                }
            });
        } else {
            this._currentModel.computeSuggestion(this._dataset, timestampStart, timestampEnd, confidenceThreshold, generation, cbProxy);
        }
    }

    public cancelSuggestion(callback: LabelingSuggestionCallback): void {
        if (this._computingInstances.has(callback)) {
            const info = this._computingInstances.get(callback);
            this._computingInstances.delete(callback);
            if (info.model) { info.model.cancelSuggestion(info.callback); }
        }
    }

}
