// Warps SPRINGDTWSuggestionModelFactory with a WebWorker.

import {Dataset} from '../../common/dataset';
import {Label} from '../../common/labeling';
import {LabelingSuggestionCallback, LabelingSuggestionModel, LabelingSuggestionModelFactory} from './LabelingSuggestionEngine';
import {EventEmitter} from 'events';



class WorkerModel extends LabelingSuggestionModel {
    private _modelID: string;
    private _parent: SpingDtwSuggestionModelFactoryWebWorker;
    private _currentCallbackID: number;
    private _registeredCallbacks: Map<string, Function>;
    private _callback2ID: WeakMap<Function, string>;

    constructor(parent: SpingDtwSuggestionModelFactoryWebWorker, modelID: string) {
        super();
        this._modelID = modelID;
        this._parent = parent;
        this._currentCallbackID = 1;
        this._registeredCallbacks = new Map<string, Function>();
        this._callback2ID = new WeakMap<Function, string>();
        parent.onModelMessage(modelID, this.onMessage.bind(this));
    }

    private onMessage(data: any): void {
        const message = data.message;
        if (message.type === 'callback') {
            const cb = this._registeredCallbacks.get(message.callbackID);
            if (cb) {
                cb(message.labels, message.progress, message.completed);
            }
        }
        if (message.type === 'get-deployment-code-callback') {
            const cb = this._registeredCallbacks.get(message.callbackID);
            if (cb) {
                cb(message.code);
            }
        }
    }

    public computeSuggestion(
        dataset: Dataset,
        timestampStart: number,
        timestampEnd: number,
        confidenceThreshold: number,
        generation: number,
        callback: LabelingSuggestionCallback): void {

        // console.log('WebWorker.computeSuggestion', this._modelID, generation);
        this._parent.setDataset(dataset);

        const callbackID = 'cb' + this._currentCallbackID.toString();
        this._currentCallbackID += 1;

        this._registeredCallbacks.set(callbackID, callback);
        this._callback2ID.set(callback, callbackID);

        this._parent.postModelMessage(this._modelID, {
            type: 'compute',
            callbackID: callbackID,
            timestampStart: timestampStart,
            timestampEnd: timestampEnd,
            confidenceThreshold: confidenceThreshold,
            generation: generation
        });
    }


    public cancelSuggestion(callback: LabelingSuggestionCallback): void {
        // console.log('WebWorker.cancelSuggestion', this._modelID);
        if (this._callback2ID.has(callback)) {
            this._parent.postModelMessage(this._modelID, {
                type: 'compute.cancel',
                callbackID: this._callback2ID.get(callback)
            });
            this._callback2ID.delete(callback);
        }
    }

    public getDeploymentCode(platform: string, callback: (code: string) => any): void {
        const callbackID = 'cb' + this._currentCallbackID.toString();
        this._currentCallbackID += 1;

        this._registeredCallbacks.set(callbackID, callback);
        this._callback2ID.set(callback, callbackID);

        this._parent.postModelMessage(this._modelID, {
            type: 'get-deployment-code',
            callbackID: callbackID,
            platform: platform
        });
    }

    public dispose(): void {
        this._parent.postModelMessage(this._modelID, {
            type: 'dispose'
        });
    }
}



export class SpingDtwSuggestionModelFactoryWebWorker extends LabelingSuggestionModelFactory {
    private _worker: Worker;
    private _currentDataset: Dataset;
    private _registeredCallbacks: Map<string, (model: LabelingSuggestionModel, progress: number, error: string) => void>;
    private _currentCallbackID: number;
    private _emitter: EventEmitter;

    constructor() {
        super();
        this._worker = new Worker('./app/js/suggestion/labeling/suggestionWorker.browserified.js');
        this._emitter = new EventEmitter();
        this._registeredCallbacks = new Map<string, (model: LabelingSuggestionModel, progress: number, error: string) => void>();

        this._currentDataset = null;
        this._worker.onmessage = event => {
            const data = event.data;
            this._emitter.emit(data.type, data);
        };
        this._currentCallbackID = 1;

        this._emitter.addListener('model.build.callback', (data) => {
            const callbackID = data.callbackID;
            const cb = this._registeredCallbacks.get(callbackID);
            if (cb) {
                cb(data.modelID ? new WorkerModel(this, data.modelID) : null, data.progress, data.error);
                this._registeredCallbacks.delete(callbackID);
            }
        });
    }

    public onModelMessage(modelID: string, callback: (message: any) => void): void {
        this._emitter.addListener('model.message.' + modelID, callback);
    }

    public postModelMessage(modelID: string, message: any): void {
        this._worker.postMessage({
            type: 'model.message.' + modelID,
            modelID: modelID,
            message: message
        });
    }

    public setDataset(dataset: Dataset): void {
        if (dataset !== this._currentDataset) {
            this._worker.postMessage({
                type: 'dataset.set',
                dataset: dataset.serialize()
            });
            this._currentDataset = dataset;
        }
    }


    public buildModel(
        dataset: Dataset,
        labels: Label[],
        callback: (model: LabelingSuggestionModel, progress: number, error: string) => void): void {

        this.setDataset(dataset);

        const callbackID = 'cb' + this._currentCallbackID.toString();
        this._currentCallbackID += 1;

        this._registeredCallbacks.set(callbackID, callback);

        this._worker.postMessage({
            type: 'model.build',
            callbackID: callbackID,
            labels: labels
        });
    }
}
