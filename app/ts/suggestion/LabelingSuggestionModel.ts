import { Dataset } from '../stores/dataStructures/dataset';
import { Label } from '../stores/dataStructures/labeling';



export interface LabelingSuggestionProgress {
    timestampStart: number;
    timestampCompleted: number;
    timestampEnd: number;
    generation: number;
    confidenceHistogram?: number[];
}

export interface LabelingSuggestionEngineStatus {
    status: 'BUILDING_MODEL' | 'MODEL_READY';
}

export type LabelingSuggestionCallback = (labels: Label[], progress: LabelingSuggestionProgress, completed: boolean) => void;

export abstract class LabelingSuggestionModel {
    // Compute suggestions in the background.
    // Calling computeSuggestion should cancel the one currently running.
    // Callback will be called multiple times, the last one should have completed set to true OR error not null.
    public abstract computeSuggestion(
        dataset: Dataset,
        timestampStart: number,
        timestampEnd: number,
        confidenceThreshold: number,
        generation: number,
        callback: LabelingSuggestionCallback): void;

    public abstract cancelSuggestion(callback: LabelingSuggestionCallback): void;

    //TODO: should model implement this?
    public abstract getDeploymentCode(platform: string, callback: (code: string) => any): void;

    public abstract dispose(): void;
}
