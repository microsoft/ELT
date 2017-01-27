// LabelingUIStore
// Labeling selection and hovering states.
// Options for labeling and suggestions (move to elsewhere?)

import { Label, PartialLabel, SignalsViewMode } from '../stores/dataStructures/labeling';
import { ObservableSet } from '../stores/dataStructures/ObservableSet';
import { getLabelingSuggestionLogic, LabelingSuggestionLogic, LabelingSuggestionLogicType } from '../suggestion/LabelingSuggestionLogic';
import { LabelingStore } from './LabelingStore';
import { labelingStore } from './stores';
import { action, computed, observable } from 'mobx';


// LabelingUIStore
// Labeling selection and hovering states.
// Options for labeling and suggestions (move to elsewhere?)

export class LabelingUiStore {
    // Label hover and selection.
    @observable public hoveringLabel: Label;
    @observable public selectedLabels: ObservableSet<Label>;

    // Current selected class.
    @observable public currentClass: string;

    // Display settings.
    @observable public signalsViewMode: SignalsViewMode;

    // // Playback control.
    // private _isPlaying: boolean;
    // private _playingTimer: NodeJS.Timer;

    // Suggestion status.
    private _isSuggesting: boolean;
    private _suggestionTimestampStart: number;
    private _suggestionTimestampCompleted: number;
    private _suggestionTimestampEnd: number;
    private _suggestionConfidenceHistogram: number[];

    // Suggestion settings.
    @observable public suggestionEnabled: boolean;
    @observable public suggestionConfidenceThreshold: number;
    private _changePointsEnabled: boolean;

    @observable public suggestionLogic: LabelingSuggestionLogic;

    private _microAdjusterType: string;

    constructor(labelingStore: LabelingStore) {

        this.signalsViewMode = SignalsViewMode.TIMESERIES;

        this.hoveringLabel = null;
        this.selectedLabels = new ObservableSet<Label>(
            lab => lab.className + ':' + lab.timestampStart + '-' + lab.timestampEnd);

        this.suggestionEnabled = true;
        this.suggestionLogic = getLabelingSuggestionLogic(LabelingSuggestionLogicType.CURRENT_VIEW);
        this._changePointsEnabled = true;
        this.suggestionConfidenceThreshold = 0.2;
        this._suggestionConfidenceHistogram = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

        const nonIgnoreClases = labelingStore.classes.filter(x => x !== 'IGNORE');
        this.currentClass = nonIgnoreClases.length > 0 ? nonIgnoreClases[0] : null;

        this._isSuggesting = false;
        this._suggestionTimestampStart = null;
        this._suggestionTimestampCompleted = null;
        this._suggestionTimestampEnd = null;

        this._microAdjusterType = 'frame-drag';

        // // NOTICE THAT THIS STORES PARENT IS A LABELING STORE??
        // labelingStore.classesChanged.on(this.onClassesChanged.bind(this));
        // labelingStore.labelsArrayChanged.on(this.onLabelsArrayChanged.bind(this));
    }


    @computed public get suggestionProgress(): number[] {
        if (!this._isSuggesting) { return null; }
        return [this._suggestionTimestampStart, this._suggestionTimestampCompleted, this._suggestionTimestampEnd];
    }

    @computed public get suggestionConfidenceHistogram(): number[] {
        return this._suggestionConfidenceHistogram;
    }


    @action public hoverLabel(label: Label): void {
        if (this.hoveringLabel !== label) {
            this.hoveringLabel = label;
        }
    }

    @action public selectLabel(label: Label, ctrlSelect: boolean = false, shiftSelect: boolean = false): void {
        const previous_selected_labels: Label[] = [];
        this.selectedLabels.forEach(lab => { previous_selected_labels.push(lab); });
        this.selectedLabels.clear();
        this.selectedLabels.add(label);
        // Change current class to label's class.
        this.currentClass = label.className;
    }

    @action public clearLabelSelection(): void {
        const previous_selected_labels: Label[] = [];
        this.selectedLabels.forEach(label => { previous_selected_labels.push(label); });
        this.selectedLabels.clear();
    }

    @action public selectClass(className: string): void {
        // Change current class to label's class.
        if (this.currentClass !== className) {
            if (labelingStore.classes.indexOf(className) >= 0) {
                this.currentClass = className;
            }
        }
    }

    @action public setSuggestionProgress(
        suggesting: boolean,
        timestampStart: number,
        timestampCompleted: number,
        timestampEnd: number,
        confidenceHistogram?: number[]): void {

        this._isSuggesting = suggesting;
        this._suggestionTimestampStart = timestampStart;
        this._suggestionTimestampCompleted = timestampCompleted;
        this._suggestionTimestampEnd = timestampEnd;
        if (confidenceHistogram) {
            this._suggestionConfidenceHistogram = confidenceHistogram;
        }
    }

    @action public setSuggestionConfidenceThreshold(threshold: number): void {
        if (this.suggestionConfidenceThreshold !== threshold) {
            this.suggestionConfidenceThreshold = threshold;
        }
    }

    @action public setSuggestionEnabled(enabled: boolean): void {
        this.suggestionEnabled = enabled;
    }

    @action public setSuggestionLogic(logic: LabelingSuggestionLogicType): void {
        this.suggestionLogic = getLabelingSuggestionLogic(logic);
    }

    @action public setSignalsViewMode(mode: SignalsViewMode): void {
        this.signalsViewMode = mode;
    }

    @action public updateLabel(label: Label, newLabel: PartialLabel): void {
        labelingStore.updateLabel(label, newLabel);
    }

    @action public removeLabel(label: Label): void {
        labelingStore.removeLabel(label);
    }


    // private onClassesChanged(): void {
    //     if (labelingStore.classes.indexOf(this.currentClass) < 0) {
    //         this.currentClass = labelingStore.classes.length > 0 ? labelingStore.classes[0] : null;
    //     }
    // }

    // private onLabelsArrayChanged(): void {
    //     // Remove labels from selection if deleted.
    //     let deleted_labels = false;
    //     this.selectedLabels.forEach(label => {
    //         if (labelingStore.labels.indexOf(label) < 0) {
    //             this.selectedLabels.remove(label);
    //             deleted_labels = true;
    //         }
    //     });
    // }

    public getLabelsInRange(timestampStart: number, timestampEnd: number): Label[] {
        // FIXME: I think all these filters accomplish nothing.
        const labels = labelingStore.getLabelsInRange(timestampStart, timestampEnd);
        return labels.filter(l => l !== this.hoveringLabel && !this.selectedLabels.has(l)).concat(
            labels.filter(l => l !== this.hoveringLabel && this.selectedLabels.has(l))).concat(
            labels.filter(l => l === this.hoveringLabel));
    }

    public isLabelHovered(label: Label): boolean {
        return this.hoveringLabel === label;
    }

    public isLabelSelected(label: Label): boolean {
        return this.selectedLabels.has(label);
    }

}
