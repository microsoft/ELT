// The webworker entry point for the worker-based DTW model factory.

import { Dataset } from '../../stores/dataStructures/dataset';
import { Label } from '../../stores/dataStructures/labeling';
import { DtwAlgorithm, LabelingSuggestionCallback, LabelingSuggestionModel, LabelingSuggestionProgress} from '../suggestion';
import { ModelBuildMessage, ModelMessage, SetDatasetMessage } from './SuggestionWorkerMessage';
import { EventEmitter } from 'events';


export class DtwSuggestionWorker extends EventEmitter {
    private _dataset: Dataset;
    private _currentModelID: number;

    constructor() {
        super();
        this._currentModelID = 1;

        this.addListener('dataset.set', (data: SetDatasetMessage) => {
            const ds = new Dataset();
            ds.deserialize(data.dataset);
            this._dataset = ds;
        });

        this.addListener('model.build', (data: ModelBuildMessage) => {
            const labels = data.labels;
            const buildCallbackID = data.callbackID;
 
            const model = DtwAlgorithm.createModel(this._dataset, labels);

            const modelID = 'model-' + this._currentModelID.toString();
            this._currentModelID += 1;

            this.emit('.post', {
                kind: 'model.build.callback',
                modelID: modelID,
                callbackID: buildCallbackID
            });
            const callbackID2Mapping = new Map<string, [LabelingSuggestionModel, Function]>();

            this.addListener('model.message.' + modelID, (modelData: ModelMessage) => {
                const message = modelData.message;
                if (message.kind === 'compute') {
                    const callback = (computeLabels: Label[], computeProgress: LabelingSuggestionProgress, completed: boolean) => {
                        this.emit('.post', {
                            kind: 'model.message.' + modelID,
                            message: {
                                kind: 'callback',
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
                if (message.kind === 'get-deployment-code') {
                    const callback = (code: string) => {
                        this.emit('.post', {
                            kind: 'model.message.' + modelID,
                            message: {
                                kind: 'get-deployment-code-callback',
                                callbackID: message.callbackID,
                                code: code
                            }
                        });
                    };
                    callbackID2Mapping.set(message.callbackID, [model, callback]);
                    model.getDeploymentCode(message.platform, callback);
                }
                if (message.kind === 'compute.cancel') {
                    if (callbackID2Mapping.has(message.callbackID)) {
                        const [tModel, tCallback] = callbackID2Mapping.get(message.callbackID);
                        tModel.cancelSuggestion(tCallback as LabelingSuggestionCallback);
                    }
                }
                if (message.kind === 'dispose') {
                    if (model) {
                        model.dispose();
                        this.removeAllListeners('model.message.' + modelID);
                    }
                }
            });
        });
    }

    public handleMessage(data: any): void {
        this.emit(data.kind, data);
    }
}

const worker = new DtwSuggestionWorker();

self.onmessage = (message) => {
    const data = message.data;
    worker.handleMessage(data);
};

worker.addListener('.post', (message) => {
    self.postMessage(message, undefined);
});
