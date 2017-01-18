import * as actions from '../actions/Actions';
import { AlignedTimeSeries } from '../stores/dataStructures/alignment';
import { Label, LabelConfirmationState, PartialLabel } from '../stores/dataStructures/labeling';
import { SavedLabelingState } from '../stores/dataStructures/project';
import { mergeTimeRangeArrays, TimeRangeIndex } from '../stores/dataStructures/timeRangeIndex';
import { resampleColumn } from '../stores/dataStructures/sampling';
import { PerItemEventListeners } from '../stores/utils';
import { Dataset, SensorTimeSeries } from '../stores/dataStructures/dataset';
import { globalDispatcher } from '../dispatcher/globalDispatcher';
import { AlignmentStore } from './AlignmentStore';
import { NodeEvent, NodeItemEvent } from './NodeEvent';
import { alignmentLabelingStore, alignmentLabelingUiStore, labelingUiStore, uiStore } from './stores';
import { UiStore } from './UiStore';
import * as d3 from 'd3';
import { EventEmitter } from 'events';
import { observer } from 'mobx-react';
import { action, observable, computed } from 'mobx';

const colorbrewer6 = [
    '#a6cee3', '#b2df8a', '#fb9a99', '#fdbf6f', '#cab2d6', '#ffff99'
];

const d3category20 = [
    '#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78', '#2ca02c',
    '#98df8a', '#d62728', '#ff9896', '#9467bd', '#c5b0d5',
    '#8c564b', '#c49c94', '#e377c2', '#f7b6d2', '#7f7f7f',
    '#c7c7c7', '#bcbd22', '#dbdb8d', '#17becf', '#9edae5'
];

export class LabelingStore {
    private _labelsIndex: TimeRangeIndex<Label>;
    private _windowLabelsIndex: TimeRangeIndex<Label>;
    private _windowAccuracyLabelsIndex: TimeRangeIndex<Label>;
    private _suggestedLabelsIndex: TimeRangeIndex<Label>;

    private _windowLabelIndexHistory: TimeRangeIndex<Label>[];
    private _windowLabelsHistory: Label[][];

    @observable public changePoints: number[];
    @observable public classes: string[];
    @observable public classColors: string[];
    @observable public classColormap: { [name: string]: string };
    @observable public timestampConfirmed: number;

    private _labelChangedListeners: PerItemEventListeners<Label>;

    @observable public alignedDataset: Dataset;
    private _shouldUpdateAlignedDatasetOnNextTabChange: boolean;
 

    // FIXME: when to use computed vs just a regular function?   
    @computed public get labels(): Label[] {
        return this._labelsIndex.getRanges();
    }

    @computed public get suggestions(): Label[] {
        return this._suggestedLabelsIndex.getRanges();
    }
  
    // FIXME: possibly make these computed
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

    constructor(alignmentStore: AlignmentStore, uiStore: UiStore) {
        this._labelsIndex = new TimeRangeIndex<Label>();
        this._windowLabelsIndex = new TimeRangeIndex<Label>();
        this._suggestedLabelsIndex = new TimeRangeIndex<Label>();
        this._windowAccuracyLabelsIndex = new TimeRangeIndex<Label>();

        this._windowLabelIndexHistory = [];
        this._windowLabelsHistory = [];

        this.classes = ['IGNORE', 'Positive'];
        this.updateColors();
        this.timestampConfirmed = null;

        this.changePoints = [];

        this._labelChangedListeners = new PerItemEventListeners<Label>();

        this.alignedDataset = null;
        this._shouldUpdateAlignedDatasetOnNextTabChange = false;
        alignmentStore.alignmentChanged.on(this.updateAlignedDataset.bind(this));
        uiStore.tabChanged.on(() => {
            if (this._shouldUpdateAlignedDatasetOnNextTabChange &&
                uiStore.currentTab === 'labeling') {
                this.updateAlignedDataset();
            }
        });

    }

    @action
    public addLabel(label: Label): void {
        alignmentLabelingStore.labelingHistoryRecord();
        this._labelsIndex.add(label);
    }

    @action
    public removeLabel(label: Label): void {
        alignmentLabelingStore.labelingHistoryRecord();
        if (this._labelsIndex.has(label)) {
            this._labelsIndex.remove(label);
        }
        if (this._suggestedLabelsIndex.has(label)) {
            label.state = LabelConfirmationState.REJECTED;
        }
    }

    @action
    public updateLabel(label: Label, newLabel: PartialLabel): void {
        alignmentLabelingStore.labelingHistoryRecord();
        // Update the label info.
        if (newLabel.timestampStart !== undefined) { label.timestampStart = newLabel.timestampStart; }
        if (newLabel.timestampEnd !== undefined) { label.timestampEnd = newLabel.timestampEnd; }
        if (newLabel.className !== undefined) { label.className = newLabel.className; }
        if (newLabel.state !== undefined) { label.state = newLabel.state; }
        if (newLabel.suggestionConfidence !== undefined) {
            label.suggestionConfidence = newLabel.suggestionConfidence;
        }
        if (newLabel.suggestionGeneration !== undefined) {
            label.suggestionGeneration = newLabel.suggestionGeneration;
        }

        // Turn a suggestion into a label, criteria: BOTH ends confirmed.
        if (this._suggestedLabelsIndex.has(label)) {
            if (label.state === LabelConfirmationState.CONFIRMED_BOTH) {
                this._suggestedLabelsIndex.remove(label);
                this._labelsIndex.add(label);

                const decision = labelingUiStore.suggestionLogic.onConfirmLabels({
                    labelsConfirmed: [label],
                    currentSuggestions: this._suggestedLabelsIndex
                });
                if (decision) {
                    if (decision.confirmLabels) {
                        decision.confirmLabels.forEach((label) => {
                            label.state = LabelConfirmationState.CONFIRMED_BOTH;
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
                        });
                    }
                }
            }
        }
    }

    @action
    public suggestLabels(labels: Label[], timestampStart: number, timestampEnd: number, timestampCompleted: number, generation: number): void {
        const lastLabelTimestampEnd = timestampCompleted;
        const thisGeneration = generation;
        let labelsChanged = false;
        const selectedLabels = labelingUiStore.selectedLabels;

        if (lastLabelTimestampEnd !== null) {
            // get labels that are earlier than the current suggestion timestamp.
            const refreshDecision = labelingUiStore.suggestionLogic.refreshSuggestions({
                suggestionProgress: {
                    timestampStart: timestampStart,
                    timestampEnd: timestampEnd,
                    timestampCompleted: timestampCompleted
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
        labels.forEach((label) => {
            const margin = (label.timestampEnd - label.timestampStart) * 0.15;
            if (this._labelsIndex.getRangesWithMargin(label.timestampStart, label.timestampEnd, margin).length === 0 &&
                this._suggestedLabelsIndex.getRangesWithMargin(label.timestampStart, label.timestampEnd, margin).length === 0) {
                this._suggestedLabelsIndex.add(label);
                labelsChanged = labelsChanged || true;
            }
        });
    }

    @action
    public suggestChangePoints(changePoints: number[]): void {
        this.changePoints = changePoints;
    }

    // FIXME: removeAllSuggestions also called in LabelingSUggestionGenerator
    @action
    public removeAllSuggestions(): void {
        if (this._suggestedLabelsIndex.size() > 0) {
            this._suggestedLabelsIndex.clear();
        }
    }

    @action
    public removeAllLabels(): void {
        alignmentLabelingStore.labelingHistoryRecord();
        if (this._labelsIndex.size() > 0) {
            this._labelsIndex.clear();
        }
        if (this._suggestedLabelsIndex.size() > 0) {
            this._suggestedLabelsIndex.clear();
        }
    }

    @action
    public addClass(className: string): void {
        alignmentLabelingStore.labelingHistoryRecord();
        if (this.classes.indexOf(className) < 0) {
            this.classes.push(className);
            this.updateColors();
        }
    }

    @action
    public removeClass(className: string): void {
        alignmentLabelingStore.labelingHistoryRecord();
        // Remove the labels of that class.
        const toRemove = [];
        this._labelsIndex.forEach((label) => {
            if (label.className === className) {
                toRemove.push(label);
            }
        });
        if (toRemove.length > 0) {
            toRemove.forEach(this._labelsIndex.remove.bind(this._labelsIndex));
        }

        // Remove the class.
        const index = this.classes.indexOf(className);
        if (index >= 0) {
            this.classes.splice(index, 1);
            this.updateColors();
        }
    }

    @action
    public renameClass(oldClassName: string, newClassName: string): void {
        alignmentLabelingStore.labelingHistoryRecord();
        if (this.classes.indexOf(newClassName) < 0) {
            let renamed = false;
            this._labelsIndex.forEach((label) => {
                if (label.className === oldClassName) {
                    label.className = newClassName;
                    renamed = true;
                }
            });
            this._suggestedLabelsIndex.forEach((label) => {
                if (label.className === oldClassName) {
                    label.className = newClassName;
                    renamed = true;
                }
            });
            
            const index = this.classes.indexOf(oldClassName);
            if (index >= 0) {
                this.classes[index] = newClassName;
                this.updateColors();
                labelingUiStore.currentClass = newClassName;
            }
        }
    }

    @action
    public confirmVisibleSuggestions() {
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
        });
    }


    private updateColors(): void {
        // Update class colors, try to keep original colors.
        this.classColors = this.classes.map(() => null);
        const usedColors = [];
        if (this.classColormap) {
            for (let i = 0; i < this.classes.length; i++) {
                if (this.classColormap[this.classes[i]]) {
                    this.classColors[i] = this.classColormap[this.classes[i]];
                    usedColors.push(this.classColors[i]);
                } else {
                    this.classColors[i] = null;
                }
            }
        }

        let palette = d3category20;
        if (this.classes.length < 6) { palette = colorbrewer6; }

        for (let i = 0; i < this.classes.length; i++) {
            if (this.classColors[i] === null) {
                if (this.classes[i] === 'IGNORE') {
                    this.classColors[i] = '#CCC';
                    usedColors.push(this.classColors[i]);
                } else {
                    for (let j = 0; j < palette.length; j++) {
                        if (usedColors.indexOf(palette[j]) < 0) {
                            this.classColors[i] = palette[j];
                            usedColors.push(this.classColors[i]);
                            break;
                        }
                    }
                }
            }
        }
        this.classColormap = {};
        for (let i = 0; i < this.classColors.length; i++) {
            this.classColormap[this.classes[i]] = this.classColors[i];
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

        this.alignedDataset = dataset;
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
            this.classes = state.classes;
            this.classColormap = state.classColormap;
            this.updateColors();
        }

        this._labelsIndex.clear();
        this._suggestedLabelsIndex.clear();
        for (const label of state.labels) {
            this._labelsIndex.add(label);
        }
        
        // Update the current class.
        const nonIgnoreClases = this.classes.filter((x) => x !== 'IGNORE');
        labelingUiStore.currentClass = nonIgnoreClases.length > 0 ? nonIgnoreClases[0] : null;
    }

    public reset(): void {
        this._labelsIndex.clear();
        this._suggestedLabelsIndex.clear();
        this.classes = ['IGNORE', 'Positive'];
        this.updateColors();
        this.changePoints = [];
        const nonIgnoreClases = this.classes.filter((x) => x !== 'IGNORE');
        labelingUiStore.currentClass = nonIgnoreClases.length > 0 ? nonIgnoreClases[0] : null;
    }

}
