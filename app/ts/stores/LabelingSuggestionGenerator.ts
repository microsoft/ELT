import * as Actions from '../actions/Actions';
import { pelt } from '../common/algorithms/pelt';
import { Label, LabelConfirmationState } from '../stores/dataStructures/labeling';
import { ArrayThrottler} from '../stores/utils';
import { SensorTimeSeries } from '../stores/dataStructures/dataset';
import { computeDimensionsMipmapLevels } from '../components/common/Mipmap';
import { globalDispatcher } from '../dispatcher/globalDispatcher';
import { DtwSuggestionModelBuilder, LabelingSuggestionCallback, LabelingSuggestionEngine, LabelingSuggestionProgress }
    from '../suggestion/suggestion';
import { alignmentLabelingUiStore, labelingStore, labelingUiStore } from './stores';
import { EventEmitter } from 'events';



// This object is not exactly a store - it doesn't listen to actions, but listen to store updates and dispatch actions.
export class LabelingSuggestionGenerator extends EventEmitter {

    private _engine: LabelingSuggestionEngine;
    private _throttler: ArrayThrottler<Label, number[]>;
    private _generation: number;
    private _currentSuggestionCallback: LabelingSuggestionCallback;

    constructor() {
        super();

        this._engine = new LabelingSuggestionEngine(new DtwSuggestionModelBuilder());

        this._engine.addStatusUpdateListener((status) => {
            this.emitStatusUpdate(status.status);
        });

        // Controls the speed to add suggestions to the label array.
        this._throttler = new ArrayThrottler<Label, number[]>(100, this.addSuggestions.bind(this));

        this.scheduleRunSuggestions = this.scheduleRunSuggestions.bind(this);
        this.runSuggestionsZoomChanged = this.runSuggestionsZoomChanged.bind(this);
        this.onLabelsChanged = this.onLabelsChanged.bind(this);

        // When should we rerun suggestions.
        // On labels changed.
        labelingStore.alignedDatasetChanged.on(this.onLabelsChanged);
        labelingStore.labelsArrayChanged.on(this.onLabelsChanged);
        labelingStore.labelsChanged.on(this.onLabelsChanged);
        // On view changed.
        alignmentLabelingUiStore.referenceViewChanged.on(this.runSuggestionsZoomChanged);
        // On parameters changed.
        labelingUiStore.suggestionConfidenceThresholdChanged.on(this.scheduleRunSuggestions);
        labelingUiStore.suggestionEnabledChanged.on(this.scheduleRunSuggestions);
        labelingUiStore.suggestionLogicChanged.on(this.scheduleRunSuggestions);

        // Per-label confirmation logic: If a label remains selected for 200 ms, confirm it.
        labelingUiStore.selectedLabelsChanged.on(() => {
            labelingUiStore.selectedLabels.forEach(
                label => {
                    setTimeout(
                        () => {
                            if (labelingUiStore.selectedLabels.has(label)) {
                                if (label.state === LabelConfirmationState.UNCONFIRMED ||
                                    label.state === LabelConfirmationState.CONFIRMED_START ||
                                    label.state === LabelConfirmationState.CONFIRMED_END) {
                                    new Actions.LabelingActions.UpdateLabel(
                                        label,
                                        { state: LabelConfirmationState.CONFIRMED_BOTH })
                                        .dispatch();
                                }
                            }
                        },
                        200); // time to confirm = 200ms.
                });
        });

        globalDispatcher.register(action => {
            // Updating labels.
            if (action instanceof Actions.LabelingActions.RemoveAllSuggestions) {
                setTimeout(
                    () => {
                        this._engine.cancelSuggestion(this._currentSuggestionCallback);
                        new Actions.LabelingActions.SetSuggestionProgress(false, null, null, null).dispatch();
                    },
                    1);
            }
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

    private emitStatusUpdate(status: string): void {
        this._currentModelStatus = status;
        this.emit('status-update', status);
    }

    public addStatusUpdateListener(callback: (status: string) => void): void {
        this.addListener('status-update', callback);
    }

    public removeStatusUpdateListener(callback: (status: string) => void): void {
        this.addListener('status-update', callback);
    }

    private onLabelsChanged(): void {
        this._engine.setDataset(labelingStore.alignedDataset);
        this._engine.setLabels(labelingStore.labels);
        this.scheduleRunSuggestions();
    }

    private _runSuggestionsTimeout: NodeJS.Timer;

    private scheduleRunSuggestions(): void {
        setImmediate(() => {
            // Cancel current suggestion if running.
            this._engine.cancelSuggestion(this._currentSuggestionCallback);
            new Actions.LabelingActions.SetSuggestionProgress(false, null, null, null).dispatch();
            if (this._runSuggestionsTimeout) { clearTimeout(this._runSuggestionsTimeout); }

            if (labelingUiStore.suggestionEnabled) {
                this._runSuggestionsTimeout = setTimeout(
                    () => {
                        this.doRunSuggestions();
                    },
                    100);
            }
        });
    }

    private runSuggestionsZoomChanged(): void {
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
        new Actions.LabelingActions.SetSuggestionProgress(false, null, null, null).dispatch();

        // Get a new generation number.
        this._generation = new Date().getTime();

        // Create a new suggestion callback (bind will return a new one).
        this._currentSuggestionCallback = this.onSuggestion.bind(this);

        // Suggestion range from suggestion logic.
        const suggestionRange = labelingUiStore.suggestionLogic.calculateSuggestionRange({
            dataset: null /* TODO */,
            labels: labelingStore.labels,
            detailedViewRange: {
                timestampStart: alignmentLabelingUiStore.referenceViewStart,
                timestampEnd: alignmentLabelingUiStore.referenceViewEnd
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
        // Throttle suggestions so we don't update the view too often.
        this._throttler.setStationary([progress.timestampStart, progress.timestampEnd, progress.timestampCompleted, this._generation]);
        this._throttler.addItems(labels);
        new Actions.LabelingActions.SetSuggestionProgress(
            !completed, progress.timestampStart, progress.timestampCompleted, progress.timestampEnd, progress.confidenceHistogram)
            .dispatch();
    }

    private addSuggestions(labels: Label[], stat: [number, number, number, number]): void {
        // On add suggestions.
        new Actions.LabelingActions.SuggestLabels(labels, stat[0], stat[1], stat[2], stat[3]).dispatch();
    }
}



export const labelingSuggestionGenerator = new LabelingSuggestionGenerator();



export class LabelingChangePointSuggestionGenerator extends EventEmitter {

    constructor() {
        super();

        this.runSuggestions = this.runSuggestions.bind(this);

        labelingStore.alignedDatasetChanged.on(() => {
            setTimeout(
                () => {
                    this.runSuggestions();
                },
                100);
        });
    }

    private runSuggestions(): void {
        const dataset = labelingStore.alignedDataset; // labelingStore.dataset;
        if (!dataset) { return; }

        // AlignedDataset is of the same sample rate always.

        let data: Float32Array[] = [];
        for (const ts of dataset.timeSeries) {
            data = data.concat((ts as SensorTimeSeries).dimensions.map((x) => new Float32Array(x)));
        }

        data = computeDimensionsMipmapLevels(data)[2];

        const n = data[0].length;
        const sampleRate = (dataset.timestampEnd - dataset.timestampStart) / (n - 1);
        const pts = pelt(data, 20 * Math.log(n), Math.ceil(3 / sampleRate));
        const timestamps = pts.map((p) => (p / (n - 1)) * (dataset.timestampEnd - dataset.timestampStart) + dataset.timestampStart);
        new Actions.LabelingActions.SuggestChangePoints(timestamps).dispatch();
    }
}
