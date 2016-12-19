// The webworker entry point for the worker-based DTW model factory.

import {Dataset} from '../../common/dataset';
import {Label} from '../../common/labeling';
import {
    LabelingSuggestionCallback,
    LabelingSuggestionModel,
    LabelingSuggestionModelFactory,
    LabelingSuggestionProgress,
    SpringDtwSuggestionModelFactory
} from './suggestion';
import {EventEmitter} from 'events';



export class SuggestionWorker extends EventEmitter {
    private _dataset: Dataset;
    private _factory: LabelingSuggestionModelFactory;
    private _currentModelID: number;

    constructor() {
        super();
        this._factory = new SpringDtwSuggestionModelFactory();
        this._currentModelID = 1;

        this.addListener('dataset.set', (data) => {
            const ds = new Dataset();
            ds.deserialize(data.dataset);
            this._dataset = ds;
        });
        this.addListener('model.build', (data) => {
            const labels = data.labels;
            const buildCallbackID = data.callbackID;
            this._factory.buildModel(this._dataset, labels, (model: LabelingSuggestionModel, progress: number, error: string) => {
                const modelID = 'model-' + this._currentModelID.toString();
                this._currentModelID += 1;

                this.emit('.post', {
                    type: 'model.build.callback',
                    modelID: modelID,
                    callbackID: buildCallbackID
                });
                const callbackID2Mapping = new Map<string, [LabelingSuggestionModel, Function]>();

                this.addListener('model.message.' + modelID, (modelData) => {
                    const message = modelData.message;
                    if (message.type === 'compute') {
                        const callback = (computeLabels: Label[], computeProgress: LabelingSuggestionProgress, completed: boolean) => {
                            this.emit('.post', {
                                type: 'model.message.' + modelID,
                                message: {
                                    type: 'callback',
                                    callbackID: message.callbackID,
                                    labels: computeLabels,
                                    progress: computeProgress,
                                    completed: completed
                                }
                            });
                        };
                        callbackID2Mapping.set(message.callbackID, [model, callback]);
                        model.computeSuggestion(
                            this._dataset,
                            message.timestampStart,
                            message.timestampEnd,
                            message.confidenceThreshold,
                            message.generation,
                            callback);
                    }
                    if (message.type === 'get-deployment-code') {
                        const callback = (code: string) => {
                            this.emit('.post', {
                                type: 'model.message.' + modelID,
                                message: {
                                    type: 'get-deployment-code-callback',
                                    callbackID: message.callbackID,
                                    code: code
                                }
                            });
                        };
                        callbackID2Mapping.set(message.callbackID, [model, callback]);
                        model.getDeploymentCode(message.platform, callback);
                    }
                    if (message.type === 'compute.cancel') {
                        if (callbackID2Mapping.has(message.callbackID)) {
                            const [tModel, tCallback] = callbackID2Mapping.get(message.callbackID);
                            tModel.cancelSuggestion(tCallback as LabelingSuggestionCallback);
                        }
                    }
                    if (message.type === 'dispose') {
                        if (model) {
                            model.dispose();
                            model = null;
                            this.removeAllListeners('model.message.' + modelID);
                        }
                    }
                });
            });
        });
    }

    public handleMessage(data: any): void {
        this.emit(data.type, data);
    }
}

const worker = new SuggestionWorker();

self.onmessage = (message) => {
    const data = message.data;
    worker.handleMessage(data);
};

worker.addListener('.post', (message) => {
    self.postMessage(message, undefined);
});
