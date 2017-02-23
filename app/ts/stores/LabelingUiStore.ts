import { Label, SignalsViewMode, TimeRange } from './dataStructures/labeling';
import { ObservableSet } from './dataStructures/ObservableSet';
import { LabelingStore } from './LabelingStore';
import { labelingStore } from './stores';
import { action, observable } from 'mobx';


export class LabelingUiStore {
    @observable public selectedLabels: ObservableSet<Label>;
    @observable public currentClass: string;
    @observable public signalsViewMode: SignalsViewMode;

    @observable public isSuggesting: boolean;
    @observable public suggestionTimestampStart: number;
    @observable public suggestionTimestampCompleted: number;
    @observable public suggestionConfidenceHistogram: number[];

    @observable public suggestionEnabled: boolean;
    @observable public suggestionConfidenceThreshold: number;
    
    constructor(labelingStore: LabelingStore) {

        this.signalsViewMode = SignalsViewMode.TIMESERIES;

        this.selectedLabels = new ObservableSet<Label>(
            lab => lab.className + ':' + lab.timestampStart + '-' + lab.timestampEnd);

        this.suggestionEnabled = true;
        this.suggestionConfidenceThreshold = 0.2;
        this.suggestionConfidenceHistogram = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

        const nonIgnoreClases = labelingStore.classes.filter(x => x !== 'IGNORE');
        this.currentClass = nonIgnoreClases.length > 0 ? nonIgnoreClases[0] : null;

        this.isSuggesting = false;
        this.suggestionTimestampStart = null;
        this.suggestionTimestampCompleted = null;

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

        this.isSuggesting = suggesting;
        this.suggestionTimestampStart = timestampStart;
        this.suggestionTimestampCompleted = timestampCompleted;
        if (confidenceHistogram) {
            this.suggestionConfidenceHistogram = confidenceHistogram;
        }
    }

    @action public setSuggestionConfidenceThreshold(threshold: number): void {
        if (this.suggestionConfidenceThreshold !== threshold) {
            this.suggestionConfidenceThreshold = threshold;
        }
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
