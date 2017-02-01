import { getLabelingSuggestionLogic, LabelingSuggestionLogic, LabelingSuggestionLogicType } from '../suggestion/LabelingSuggestionLogic';
import { Label, SignalsViewMode, TimeRange } from './dataStructures/labeling';
import { ObservableSet } from './dataStructures/ObservableSet';
import { LabelingStore } from './LabelingStore';
import { labelingStore } from './stores';
import { action, computed, observable } from 'mobx';


export class LabelingUiStore {
    @observable public selectedLabels: ObservableSet<Label>;
    @observable public currentClass: string;
    @observable public signalsViewMode: SignalsViewMode;

    private _isSuggesting: boolean;
    private _suggestionTimestampStart: number;
    private _suggestionTimestampCompleted: number;
    private _suggestionTimestampEnd: number;
    private _suggestionConfidenceHistogram: number[];

    @observable public suggestionEnabled: boolean;
    @observable public suggestionConfidenceThreshold: number;
    private _changePointsEnabled: boolean;

    @observable public suggestionLogic: LabelingSuggestionLogic;

    private _microAdjusterType: string;

    constructor(labelingStore: LabelingStore) {

        this.signalsViewMode = SignalsViewMode.TIMESERIES;

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
    }

    @computed public get suggestionProgress(): number[] {
        if (!this._isSuggesting) { return null; }
        return [this._suggestionTimestampStart, this._suggestionTimestampCompleted, this._suggestionTimestampEnd];
    }

    @computed public get suggestionConfidenceHistogram(): number[] {
        return this._suggestionConfidenceHistogram;
    }

    @action public selectLabel(label: Label, ctrlSelect: boolean = false, shiftSelect: boolean = false): void {
        const previous_selected_labels: Label[] = [];
        this.selectedLabels.forEach(lab => { previous_selected_labels.push(lab); });
        this.selectedLabels.clear();
        this.selectedLabels.add(label);
        this.currentClass = label.className;
    }

    @action public clearLabelSelection(): void {
        const previous_selected_labels: Label[] = [];
        this.selectedLabels.forEach(label => { previous_selected_labels.push(label); });
        this.selectedLabels.clear();
    }

    @action public selectClass(className: string): void {
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
        endTime: number,
        confidenceHistogram?: number[]): void {

        this._isSuggesting = suggesting;
        this._suggestionTimestampStart = timestampStart;
        this._suggestionTimestampCompleted = timestampCompleted;
        this._suggestionTimestampEnd = endTime;
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

    public getLabelsInRange(timeRange: TimeRange): Label[] {
        const labels = labelingStore.getLabelsInRange(timeRange);
        return labels.filter(l => !this.selectedLabels.has(l)).concat(
            labels.filter(l => this.selectedLabels.has(l)));
    }

    public isLabelSelected(label: Label): boolean {
        return this.selectedLabels.has(label);
    }

}
