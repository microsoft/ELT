import * as actions from '../actions/Actions';
import {AlignedTimeSeries, Label, LabelConfirmationState, mergeTimeRangeArrays, SavedLabelingState, TimeRangeIndex} from '../common/common';
import {PerItemEventListeners, resampleColumn } from '../common/common';
import {Dataset, SensorTimeSeries} from '../common/dataset';
import {globalDispatcher} from '../dispatcher/globalDispatcher';
import {AlignmentStore} from './AlignmentStore';
import {NodeEvent, NodeItemEvent} from './NodeEvent';
import {alignmentLabelingStore, alignmentLabelingUiStore, labelingUiStore, uiStore} from './stores';
import {UiStore} from './UiStore';
import * as d3 from 'd3';
import {EventEmitter} from 'events';


const colorbrewer6 = [
    '#a6cee3', '#b2df8a', '#fb9a99', '#fdbf6f', '#cab2d6', '#ffff99'
];

const d3category20 = [
    '#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78', '#2ca02c',
    '#98df8a', '#d62728', '#ff9896', '#9467bd', '#c5b0d5',
    '#8c564b', '#c49c94', '#e377c2', '#f7b6d2', '#7f7f7f',
    '#c7c7c7', '#bcbd22', '#dbdb8d', '#17becf', '#9edae5'
];


export class LabelingStore extends EventEmitter {
    private _labelsIndex: TimeRangeIndex<Label>;
    private _windowLabelsIndex: TimeRangeIndex<Label>;
    private _windowAccuracyLabelsIndex: TimeRangeIndex<Label>;
    private _suggestedLabelsIndex: TimeRangeIndex<Label>;

    private _windowLabelIndexHistory: TimeRangeIndex<Label>[];
    private _windowLabelsHistory: Label[][];

    private _changePoints: number[];

    private _classes: string[];
    private _classColors: string[];
    private _classColormap: { [name: string]: string };
    private _timestampConfirmed: number;

    private _labelChangedListeners: PerItemEventListeners<Label>;

    private _alignedDataset: Dataset;
    private _shouldUpdateAlignedDatasetOnNextTabChange: boolean;


    constructor(alignmentStore: AlignmentStore, uiStore: UiStore) {
        super();

        this._labelsIndex = new TimeRangeIndex<Label>();
        this._windowLabelsIndex = new TimeRangeIndex<Label>();
        this._suggestedLabelsIndex = new TimeRangeIndex<Label>();
        this._windowAccuracyLabelsIndex = new TimeRangeIndex<Label>();

        this._windowLabelIndexHistory = [];
        this._windowLabelsHistory = [];

        this._classes = ['IGNORE', 'Positive'];
        this.updateColors();
        this._timestampConfirmed = null;

        this._changePoints = [];

        this._labelChangedListeners = new PerItemEventListeners<Label>();

        this._alignedDataset = null;
        this._shouldUpdateAlignedDatasetOnNextTabChange = false;
        alignmentStore.alignmentChanged.on(this.updateAlignedDataset.bind(this));
        uiStore.tabChanged.on(() => {
            if (this._shouldUpdateAlignedDatasetOnNextTabChange &&
                uiStore.currentTab === 'labeling') {
                this.updateAlignedDataset();
            }
        });

        globalDispatcher.register(action => {
            // Updating labels.
            if (action instanceof actions.LabelingActions.AddLabel) {
                alignmentLabelingStore.labelingHistoryRecord();
                this._labelsIndex.add(action.label);
                this.labelsArrayChanged.emit();
            }

            if (action instanceof actions.LabelingActions.RemoveLabel) {
                alignmentLabelingStore.labelingHistoryRecord();
                if (this._labelsIndex.has(action.label)) {
                    this._labelsIndex.remove(action.label);
                    this.labelsArrayChanged.emit();
                }
                if (this._suggestedLabelsIndex.has(action.label)) {
                    action.label.state = LabelConfirmationState.REJECTED;
                    this.labelChanged.emit(action.label);
                    this.labelsChanged.emit();
                }
            }

            if (action instanceof actions.LabelingActions.UpdateLabel) {
                alignmentLabelingStore.labelingHistoryRecord();
                // Update the label info.
                if (action.newLabel.timestampStart !== undefined) { action.label.timestampStart = action.newLabel.timestampStart; }
                if (action.newLabel.timestampEnd !== undefined) { action.label.timestampEnd = action.newLabel.timestampEnd; }
                if (action.newLabel.className !== undefined) { action.label.className = action.newLabel.className; }
                if (action.newLabel.state !== undefined) { action.label.state = action.newLabel.state; }
                if (action.newLabel.suggestionConfidence !== undefined) {
                    action.label.suggestionConfidence = action.newLabel.suggestionConfidence;
                }
                if (action.newLabel.suggestionGeneration !== undefined) {
                    action.label.suggestionGeneration = action.newLabel.suggestionGeneration;
                }

                this.labelChanged.emit(action.label);
                // Turn a suggestion into a label, criteria: BOTH ends confirmed.
                if (this._suggestedLabelsIndex.has(action.label)) {
                    if (action.label.state === LabelConfirmationState.CONFIRMED_BOTH) {
                        this._suggestedLabelsIndex.remove(action.label);
                        this._labelsIndex.add(action.label);

                        const decision = labelingUiStore.suggestionLogic.onConfirmLabels({
                            labelsConfirmed: [action.label],
                            currentSuggestions: this._suggestedLabelsIndex
                        });
                        if (decision) {
                            if (decision.confirmLabels) {
                                decision.confirmLabels.forEach((label) => {
                                    label.state = LabelConfirmationState.CONFIRMED_BOTH;
                                    this.labelChanged.emit(label);
                                    this._suggestedLabelsIndex.remove(label);
                                    this._labelsIndex.add(label);
                                });
                            }
                            if (decision.deleteLabels) {
                                decision.deleteLabels.forEach((label) => {
                                    this._suggestedLabelsIndex.remove(label);
                                });
                            }
                            if (decision.rejectLabels) {
                                decision.rejectLabels.forEach((label) => {
                                    label.state = LabelConfirmationState.REJECTED;
                                    this.labelChanged.emit(label);
                                });
                            }
                        }

                        this.suggestedLabelsArrayChanged.emit();
                        this.labelsArrayChanged.emit();
                    }
                }
                this.labelsChanged.emit();
            }

            if (action instanceof actions.LabelingActions.SuggestLabels) {
                const lastLabelTimestampEnd = action.timestampCompleted;
                const thisGeneration = action.generation;
                let labelsChanged = false;
                const selectedLabels = labelingUiStore.selectedLabels;

                if (lastLabelTimestampEnd !== null) {
                    // get labels that are earlier than the current suggestion timestamp.
                    const refreshDecision = labelingUiStore.suggestionLogic.refreshSuggestions({
                        suggestionProgress: {
                            timestampStart: action.timestampStart,
                            timestampEnd: action.timestampEnd,
                            timestampCompleted: action.timestampCompleted
                        },
                        currentSuggestions: this._suggestedLabelsIndex
                    });
                    let labelsToRemove = refreshDecision.deleteLabels;
                    // Only remove unconfirmed suggestions of older generations.
                    labelsToRemove = labelsToRemove.filter((label) =>
                        label.suggestionGeneration < thisGeneration && label.state === LabelConfirmationState.UNCONFIRMED);
                    // Don't remove selected suggestions.
                    labelsToRemove = labelsToRemove.filter((label) => !selectedLabels.has(label));
                    // Remove them.
                    labelsToRemove.forEach((label) => this._suggestedLabelsIndex.remove(label));
                    labelsChanged = labelsChanged || labelsToRemove.length > 0;
                }
                action.labels.forEach((label) => {
                    const margin = (label.timestampEnd - label.timestampStart) * 0.15;
                    if (this._labelsIndex.getRangesWithMargin(label.timestampStart, label.timestampEnd, margin).length === 0 &&
                        this._suggestedLabelsIndex.getRangesWithMargin(label.timestampStart, label.timestampEnd, margin).length === 0) {
                        this._suggestedLabelsIndex.add(label);
                        labelsChanged = labelsChanged || true;
                    }
                });
                if (labelsChanged) {
                    this.suggestedLabelsArrayChanged.emit();
                }
            }

            if (action instanceof actions.LabelingActions.SuggestChangePoints) {
                this._changePoints = action.changePoints;
                this.suggestedChangePointsChanged.emit();
            }

            if (action instanceof actions.LabelingActions.RemoveAllSuggestions) {
                if (this._suggestedLabelsIndex.size() > 0) {
                    this._suggestedLabelsIndex.clear();
                    this.suggestedLabelsArrayChanged.emit();
                }
            }

            if (action instanceof actions.LabelingActions.RemoveAllLabels) {
                alignmentLabelingStore.labelingHistoryRecord();
                if (this._labelsIndex.size() > 0) {
                    this._labelsIndex.clear();
                    this.labelsArrayChanged.emit();
                }
                if (this._suggestedLabelsIndex.size() > 0) {
                    this._suggestedLabelsIndex.clear();
                    this.suggestedLabelsArrayChanged.emit();
                }
            }

            // Changing classes.
            if (action instanceof actions.LabelingActions.AddClass) {
                alignmentLabelingStore.labelingHistoryRecord();
                if (this._classes.indexOf(action.className) < 0) {
                    this._classes.push(action.className);
                    this.updateColors();
                    this.classesChanged.emit();
                }
            }

            if (action instanceof actions.LabelingActions.RemoveClass) {
                alignmentLabelingStore.labelingHistoryRecord();
                // Remove the labels of that class.
                const toRemove = [];
                this._labelsIndex.forEach((label) => {
                    if (label.className === action.className) {
                        toRemove.push(label);
                    }
                });
                if (toRemove.length > 0) {
                    toRemove.forEach(this._labelsIndex.remove.bind(this._labelsIndex));
                    this.labelsArrayChanged.emit();
                }

                // Remove the class.
                const index = this._classes.indexOf(action.className);
                if (index >= 0) {
                    this._classes.splice(index, 1);
                    this.updateColors();
                    this.classesChanged.emit();
                }
            }

            if (action instanceof actions.LabelingActions.RenameClass) {
                alignmentLabelingStore.labelingHistoryRecord();
                if (this._classes.indexOf(action.newClassName) < 0) {
                    let renamed = false;
                    this._labelsIndex.forEach((label) => {
                        if (label.className === action.oldClassName) {
                            label.className = action.newClassName;
                            this.labelChanged.emit(label);
                            renamed = true;
                        }
                    });
                    this._suggestedLabelsIndex.forEach((label) => {
                        if (label.className === action.oldClassName) {
                            label.className = action.newClassName;
                            this.labelChanged.emit(label);
                            renamed = true;
                        }
                    });
                    if (renamed) {
                        this.labelsArrayChanged.emit();
                        this.suggestedLabelsArrayChanged.emit();
                    }

                    const index = this._classes.indexOf(action.oldClassName);
                    if (index >= 0) {
                        this._classes[index] = action.newClassName;
                        this.updateColors();
                        this.classesChanged.emit();
                        labelingUiStore.currentClass = action.newClassName;
                    }
                }
            }

            // // Temporary save/load stuff.
            // if(action instanceof Actions.LabelingActions.SaveLabels) {
            //     fs.writeFileSync(action.filename, JSON.stringify({
            //         labels: this._labelsIndex.getRanges(),
            //         classes: this._classes
            //     }), 'utf-8');
            // }
            // if(action instanceof Actions.LabelingActions.LoadLabels) {
            //     let content = fs.readFileSync(action.filename, 'utf-8');
            //     let data = JSON.parse(content);
            //     this._labelsIndex.clear();
            //     this._labelsIndex.addRanges(data['labels']);
            //     this._classes = data['classes'];
            //     this._updateColors();
            //     this.emitClassesChanged();
            //     this.emitLabelsArrayChanged();
            // }

            if (action instanceof actions.LabelingActions.ConfirmVisibleSuggestions) {
                alignmentLabelingStore.labelingHistoryRecord();
                // Get visible suggestions.
                let visibleSuggestions = this._suggestedLabelsIndex.getRangesInRange(
                    alignmentLabelingUiStore.referenceViewStart,
                    alignmentLabelingUiStore.referenceViewEnd);
                // Filter out rejected suggestions.
                visibleSuggestions = visibleSuggestions.filter((x) => x.state !== LabelConfirmationState.REJECTED);
                visibleSuggestions.forEach((label) => {
                    label.state = LabelConfirmationState.CONFIRMED_BOTH;
                    this._suggestedLabelsIndex.remove(label);
                    this._labelsIndex.add(label);
                    this.labelChanged.emit(label);
                });
                if (visibleSuggestions.length > 0) {
                    this.labelsArrayChanged.emit();
                    this.suggestedLabelsArrayChanged.emit();
                }
            }

        });
    }

    private updateColors(): void {
        // Update class colors, try to keep original colors.
        this._classColors = this._classes.map(() => null);
        const usedColors = [];
        if (this._classColormap) {
            for (let i = 0; i < this._classes.length; i++) {
                if (this._classColormap[this._classes[i]]) {
                    this._classColors[i] = this._classColormap[this._classes[i]];
                    usedColors.push(this._classColors[i]);
                } else {
                    this._classColors[i] = null;
                }
            }
        }

        let palette = d3category20;
        if (this._classes.length < 6) { palette = colorbrewer6; }

        for (let i = 0; i < this._classes.length; i++) {
            if (this._classColors[i] === null) {
                if (this._classes[i] === 'IGNORE') {
                    this._classColors[i] = '#CCC';
                    usedColors.push(this._classColors[i]);
                } else {
                    for (let j = 0; j < palette.length; j++) {
                        if (usedColors.indexOf(palette[j]) < 0) {
                            this._classColors[i] = palette[j];
                            usedColors.push(this._classColors[i]);
                            break;
                        }
                    }
                }
            }
        }
        this._classColormap = {};
        for (let i = 0; i < this._classColors.length; i++) {
            this._classColormap[this._classes[i]] = this._classColors[i];
        }
    }

    private updateAlignedDataset(force: boolean = false): void {
        // Update only in labeling mode, if not in labeling mode, schedule an update once the mode is changed to labeling.
        if (!force && uiStore.currentTab !== 'labeling') {
            this._shouldUpdateAlignedDatasetOnNextTabChange = true;
            return;
        }
        this._shouldUpdateAlignedDatasetOnNextTabChange = false;
        // Update the aligned dataset.
        const tracks = alignmentLabelingStore.tracks;
        const dataset = new Dataset();
        // Here we generate a dataset with ONE timeSeries of uniform sample rate (the maximum of all series).
        // This makes it easier to process.

        // First determine the global dimensions and sample rate.
        const timeSeriesToMerge: AlignedTimeSeries[] = [];
        // Gather all timeSeries.
        for (const track of tracks) {
            // Each track generate a set of timeSeries.
            if (track.alignedTimeSeries.length === 0) { continue; } // skip empty track.
            // Assumption: the track only contain one timeSeries.
            const timeSeries = track.alignedTimeSeries[0];
            timeSeriesToMerge.push(timeSeries);
        }
        // The widest range of all series.
        const tMin = d3.min(timeSeriesToMerge, (ts) => ts.referenceStart);
        const tMax = d3.max(timeSeriesToMerge, (ts) => ts.referenceEnd);
        // Compute the max sample rate.
        const maxSampleRate = d3.max(timeSeriesToMerge, (ts) =>
            ((ts.timeSeries[0] as SensorTimeSeries).dimensions[0].length - 1) /
            (ts.referenceEnd - ts.referenceStart));
        // How many samples in the new dataset.
        const totalSamples = Math.ceil((tMax - tMin) * maxSampleRate);
        // Compute the actual sample rate.
        const actualSampleRate = (totalSamples - 1) / (tMax - tMin);
        for (const ts of timeSeriesToMerge) {
            const timeSeries = ts.timeSeries[0] as SensorTimeSeries;
            // Create the sensor structure.
            const sensor: SensorTimeSeries = {
                name: 'aggregated',
                kind: timeSeries.kind,
                dimensions: timeSeries.dimensions.map((d) =>
                    resampleColumn(d, ts.referenceStart, ts.referenceEnd, tMin, tMax, totalSamples)),
                timestampStart: tMin,
                timestampEnd: tMax,
                sampleRate: actualSampleRate,
                scales: timeSeries.scales
            };
            dataset.addSensor(sensor);
        }

        dataset.timestampStart = tMin;
        dataset.timestampEnd = tMax;

        this._alignedDataset = dataset;
        this.alignedDatasetChanged.emit();
    }

    // State saving and loading.
    public saveState(): SavedLabelingState {
        return {
            labels: this.labels,
            classes: this.classes,
            classColormap: this.classColormap
        };
    }

    public loadState(state: SavedLabelingState): void {
        if (state.classes) {
            this._classes = state.classes;
            this._classColormap = state.classColormap;
            this.updateColors();
        }

        this._labelsIndex.clear();
        this._suggestedLabelsIndex.clear();
        for (const label of state.labels) {
            this._labelsIndex.add(label);
        }
        // this.updateAlignedDataset(true);
        this.classesChanged.emit();
        this.labelsChanged.emit();
        this.labelsArrayChanged.emit();
        this.suggestedLabelsArrayChanged.emit();

        // Update the current class.
        const nonIgnoreClases = this.classes.filter((x) => x !== 'IGNORE');
        labelingUiStore.currentClass = nonIgnoreClases.length > 0 ? nonIgnoreClases[0] : null;
    }

    public reset(): void {
        this._labelsIndex.clear();
        this._suggestedLabelsIndex.clear();
        this._classes = ['IGNORE', 'Positive'];
        this.updateColors();
        this._changePoints = [];
        this.classesChanged.emit();
        this.labelsChanged.emit();
        this.labelsArrayChanged.emit();
        this.suggestedLabelsArrayChanged.emit();
        const nonIgnoreClases = this.classes.filter((x) => x !== 'IGNORE');
        labelingUiStore.currentClass = nonIgnoreClases.length > 0 ? nonIgnoreClases[0] : null;
    }


    public get alignedDataset(): Dataset {
        return this._alignedDataset;
    }

    // public get datasetAutocorrelogram(): Dataset {
    //     return this._datasetAutocorrelogram;
    // }

    public get labels(): Label[] {
        return this._labelsIndex.getRanges();
    }

    public get suggestions(): Label[] {
        return this._suggestedLabelsIndex.getRanges();
    }

    public get classes(): string[] {
        return this._classes;
    }

    public get classColors(): string[] {
        return this._classColors;
    }

    public get classColormap(): { [name: string]: string } {
        return this._classColormap;
    }

    public get timestampConfirmed(): number {
        return this._timestampConfirmed;
    }

    public get changePoints(): number[] {
        return this._changePoints;
    }

    public getLabelsInRange(tmin: number, tmax: number): Label[] {
        return mergeTimeRangeArrays(
            this._labelsIndex.getRangesInRange(tmin, tmax),
            this._suggestedLabelsIndex.getRangesInRange(tmin, tmax));
    }

    public getLabelsAtTime(time: number): Label[] {
        return this._labelsIndex.getRangesInRange(time, time);
    }

    public getWindowLabelsInRange(tmin: number, tmax: number): Label[] {
        return this._windowLabelsIndex.getRangesInRange(tmin, tmax);
    }

    public getWindowAccuracyLabelsInRange(tmin: number, tmax: number): Label[] {
        return this._windowAccuracyLabelsIndex.getRangesInRange(tmin, tmax);
    }

    public getWindowHistoryLabelsInRange(tmin: number, tmax: number, historyIndex: number): Label[] {
        return this._windowLabelIndexHistory[historyIndex].getRangesInRange(tmin, tmax);
    }

    public getActualLabelsInRange(tmin: number, tmax: number): Label[] {
        return this._labelsIndex.getRangesInRange(tmin, tmax);
    }


    // LabelsArrayChanged: Fire when the collection of labels is changed (e.g., add new label(s), delete existing label(s)).
    // does NOT fire when individual labels get updated, listen to LabelsChanged instead.
    public labelsArrayChanged: NodeEvent = new NodeEvent(this, 'labels-array-changed');

    // LabelsArrayChanged: Fire when the collection of labels is changed (e.g., add new label(s), delete existing label(s)).
    // does NOT fire when individual labels get updated, listen to LabelsChanged instead.
    public suggestedLabelsArrayChanged: NodeEvent = new NodeEvent(this, 'suggested-labels-array-changed');

    // LabelsChanged: Fire when label(s) get updated.
    // does NOT fire when adding/removing labels.
    // To listen to individual labels, use addLabelChangedListener.
    public labelsChanged: NodeEvent = new NodeEvent(this, 'labels-changed');

    // ClassesChanged: Fire when the list of classes and/or colors of classes get changed.
    public classesChanged: NodeEvent = new NodeEvent(this, 'classes-changed');

    // AlignedDatasetChanged: Fire when the aligned dataset 
    // (computed from the current alignment, only updated while in the labeling view) is changed.
    public alignedDatasetChanged: NodeEvent = new NodeEvent(this, 'aligned-dataset-changed');

    // SuggestedChangePointsChanged: When the changepoitn suggestion algorithm is completed.
    public suggestedChangePointsChanged: NodeEvent = new NodeEvent(this, 'suggested-change-points-changed');

    // Custom event emitting code, emit for individual labels.
    // Fire when the specified label get updated (fired together with LabelsChanged).
    // You can listen to individual labels with this function.
    public labelChanged: NodeItemEvent<Label> = new NodeItemEvent<Label>();

}
