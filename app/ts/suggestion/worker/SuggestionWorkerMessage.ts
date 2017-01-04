import {Label} from '../../stores/dataStructures/labeling';

interface ModelMessageBase {
    kind: string;
}

export interface ComputeModelMessage extends ModelMessageBase {
    kind: 'compute';
    callbackID: string;
    timestampStart: number;
    timestampEnd: number;
    confidenceThreshold: number;
    generation: number;
}


export interface CancelModelMessage extends ModelMessageBase {
    kind: 'compute.cancel';
    callbackID: string;
}

export interface GetDeploymentCodeMessage extends ModelMessageBase {
    kind: 'get-deployment-code';
    callbackID: string;
    platform: string;
}

export interface DisposeModelMessage extends ModelMessageBase {
    kind: 'dispose';
}

export type ModelSpecificMessage =
    ComputeModelMessage |
    CancelModelMessage |
    GetDeploymentCodeMessage |
    DisposeModelMessage;





interface SuggestionWorkerMessageBase {
    kind: string;
}

export interface ModelMessage extends SuggestionWorkerMessageBase {
    modelID: string;
    message: ModelSpecificMessage;
}

export interface SetDatasetMessage extends SuggestionWorkerMessageBase {
    dataset: Object; // serialized Dataset
}

export interface ModelBuildMessage extends SuggestionWorkerMessageBase {
    callbackID: string;
    labels: Label[];
}

export type SuggestionWorkerMessage =
    ModelMessage |
    SetDatasetMessage |
    ModelBuildMessage;
