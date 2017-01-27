import { computeDimensionsMipmapLevels } from '../components/common/Mipmap';
import { SensorTimeSeries } from '../stores/dataStructures/dataset';
import { Label, LabelConfirmationState } from '../stores/dataStructures/labeling';
import { LabelingStore } from '../stores/LabelingStore';
import { LabelingUiStore } from '../stores/LabelingUiStore';
import { ProjectUiStore } from '../stores/ProjectUiStore';
import { labelingStore, labelingUiStore, projectUiStore } from '../stores/stores';
import { ArrayThrottler } from '../stores/utils';
import { pelt } from '../suggestion/algorithms/pelt';
import { DtwSuggestionModelBuilder } from '../suggestion/DtwSuggestionModelBuilder';
import { LabelingSuggestionEngine } from '../suggestion/LabelingSuggestionEngine';
import { LabelingSuggestionCallback, LabelingSuggestionProgress } from '../suggestion/LabelingSuggestionModel';
import { EventEmitter } from 'events';
import { action, autorun, observable, reaction, runInAction } from 'mobx';


function delayAction(millisec: number, fun: () => void): NodeJS.Timer {
    return setTimeout(() => runInAction(fun), millisec);
}


// This object is not exactly a store - it doesn't listen to actions, but listen to store updates and dispatch actions.
export class LabelingSuggestionGenerator {

    private _engine: LabelingSuggestionEngine;
    private _throttler: ArrayThrottler<Label, number[]>;
    private _generation: number;
    private _currentSuggestionCallback: LabelingSuggestionCallback;

    constructor(labelingStore: LabelingStore, labelingUiStore: LabelingUiStore, alignmentLabelingUiStore: ProjectUiStore) {
        this._engine = new LabelingSuggestionEngine(new DtwSuggestionModelBuilder());

        // Controls the speed to add suggestions to the label array.
        this._throttler = new ArrayThrottler<Label, number[]>(100, this.addSuggestions.bind(this));

        reaction(
            () => observable([labelingStore.alignedDataset, labelingStore.labels]),
            () => this.onLabelsChanged());
        reaction(
            () => observable([
                alignmentLabelingUiStore.referenceViewStart,
                alignmentLabelingUiStore.referenceViewPPS]),
            () => this.runSuggestionsZoomChanged());
        reaction(
            () => observable([
                labelingUiStore.suggestionConfidenceThreshold,
                labelingUiStore.suggestionEnabled,
                labelingUiStore.suggestionLogic
            ]),
            () => this.scheduleRunSuggestions());

        // Per-label confirmation logic: If a label remains selected for 200 ms, confirm it.
        autorun(() => {
            labelingUiStore.selectedLabels.forEach(
                label => delayAction(200, () => {
                    if (labelingUiStore.selectedLabels.has(label)) {
                        if (label.state === LabelConfirmationState.UNCONFIRMED ||
                            label.state === LabelConfirmationState.CONFIRMED_START ||
                            label.state === LabelConfirmationState.CONFIRMED_END) {
                            labelingStore.updateLabel(label, { state: LabelConfirmationState.CONFIRMED_BOTH });
                        }
                    }
                }),
            );
        });

    }

    @action
    public removeAllSuggestions(): void {
        delayAction(1, () => {
            this._engine.cancelSuggestion(this._currentSuggestionCallback);
            labelingUiStore.setSuggestionProgress(false, null, null, null);
        });
    }

    private _currentModelStatus: string = 'IDLE';

    public get modelStatus(): string {
        return this._currentModelStatus;
    }

    // Get the deployment code for the current model.
    public getDeploymentCode(platform: string, callback: (code: string) => any): void {
        this._engine.getDeploymentCode(platform, callback);
    }

    @action private onLabelsChanged(): void {
        this._engine.setDataset(labelingStore.alignedDataset);
        this._engine.setLabels(labelingStore.labels);
        this.scheduleRunSuggestions();
    }

    private _runSuggestionsTimeout: NodeJS.Timer;

    @action private scheduleRunSuggestions(): void {
        setImmediate(() => runInAction(() => {
            // Cancel current suggestion if running.
            this._engine.cancelSuggestion(this._currentSuggestionCallback);
            labelingUiStore.setSuggestionProgress(false, null, null, null);
            if (this._runSuggestionsTimeout) { clearTimeout(this._runSuggestionsTimeout); }

            if (labelingUiStore.suggestionEnabled) {
                this._runSuggestionsTimeout = delayAction(100, () => {
                    this.doRunSuggestions();
                });
            }
        }));
    }

    @action private runSuggestionsZoomChanged(): void {
        if (labelingUiStore.suggestionLogic.shouldTriggerSuggestionUpdate({ didViewportChange: true })) {
            this.scheduleRunSuggestions();
        }
    }

    private doRunSuggestions(): void {
        // If no dataset, do nothing.
        const dataset = labelingStore.alignedDataset;
        if (!dataset) { return; }

        // Cancel the current suggestion.
        this._engine.cancelSuggestion(this._currentSuggestionCallback);
        labelingUiStore.setSuggestionProgress(false, null, null, null);

        // Get a new generation number.
        this._generation = new Date().getTime();

        // Create a new suggestion callback (bind will return a new one).
        this._currentSuggestionCallback = this.onSuggestion.bind(this);

        // Suggestion range from suggestion logic.
        const suggestionRange = labelingUiStore.suggestionLogic.calculateSuggestionRange({
            dataset: null /* TODO */,
            labels: labelingStore.labels,
            detailedViewRange: {
                timestampStart: projectUiStore.referenceViewStart,
                timestampEnd: projectUiStore.referenceViewEnd
            }
        });

        // Start computing suggestions.
        this._engine.computeSuggestion(
            suggestionRange.timestampStart,
            suggestionRange.timestampEnd,
            labelingUiStore.suggestionConfidenceThreshold,
            this._generation,
            this._currentSuggestionCallback
        );
    }

    private onSuggestion(labels: Label[], progress: LabelingSuggestionProgress, completed: boolean): void {
        runInAction(() => {
            // Throttle suggestions so we don't update the view too often.
            this._throttler.setStationary([progress.timestampStart, progress.timestampEnd, progress.timestampCompleted, this._generation]);
            this._throttler.addItems(labels);
            labelingUiStore.setSuggestionProgress(
                !completed, progress.timestampStart, progress.timestampCompleted, progress.timestampEnd, progress.confidenceHistogram);
        });
    }

    private addSuggestions(labels: Label[], stat: [number, number, number, number]): void {
        // On add suggestions.
        runInAction(() => labelingStore.suggestLabels(labels, stat[0], stat[1], stat[2], stat[3]));
    }
}





export class LabelingChangePointSuggestionGenerator extends EventEmitter {

    constructor() {
        super();

        this.runSuggestions = this.runSuggestions.bind(this);

        autorun(() => this.runSuggestions());
    }

    @action private runSuggestions(): void {
        const dataset = labelingStore.alignedDataset; // labelingStore.dataset;
        if (!dataset) { return; }

        // AlignedDataset is of the same sample rate always.

        let data: Float32Array[] = [];
        for (const ts of dataset.timeSeries) {
            data = data.concat((ts as SensorTimeSeries).dimensions.map(x => new Float32Array(x)));
        }

        data = computeDimensionsMipmapLevels(data)[2];

        const n = data[0].length;
        const sampleRate = (dataset.timestampEnd - dataset.timestampStart) / (n - 1);
        const pts = pelt(data, 20 * Math.log(n), Math.ceil(3 / sampleRate));
        const timestamps = pts.map(p => (p / (n - 1)) * (dataset.timestampEnd - dataset.timestampStart) + dataset.timestampStart);
        labelingStore.suggestChangePoints(timestamps);
    }
}
