// LabelingUIStore
// Labeling selection and hovering states.
// Options for labeling and suggestions (move to elsewhere?)

import * as actions from '../actions/Actions';
import {getLabelingSuggestionLogic, LabelingSuggestionLogic, LabelingSuggestionLogicType} from '../suggestion/LabelingSuggestionLogic';
import {Label, PartialLabel, SignalsViewMode} from '../stores/dataStructures/labeling';
import {PerItemEventListeners} from '../stores/utils';
import {globalDispatcher} from '../dispatcher/globalDispatcher';
import {LabelingStore} from './LabelingStore';
import {NodeEvent, NodeItemEvent} from './NodeEvent';
import {alignmentLabelingUiStore, labelingStore} from './stores';
import {EventEmitter} from 'events';


// LabelingUIStore
// Labeling selection and hovering states.
// Options for labeling and suggestions (move to elsewhere?)

export class LabelingUiStore extends EventEmitter {
    // Label hover and selection.
    private _hoveringLabel: Label;
    private _selectedLabels: Set<Label>;

    // Current selected class.
    private _currentClass: string;

    // Display settings.
    private _signalsViewMode: SignalsViewMode;

    // Per-label event listeners.
    private _labelHoveringListeners: PerItemEventListeners<Label>;
    private _labelSelectedListeners: PerItemEventListeners<Label>;

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
    private _suggestionEnabled: boolean;
    private _changePointsEnabled: boolean;
    private _suggestionConfidenceThreshold: number;

    private _suggestionLogic: LabelingSuggestionLogic;

    private _microAdjusterType: string;

    constructor(labelingStore: LabelingStore) {
        super();

        this._signalsViewMode = SignalsViewMode.TIMESERIES;

        this._hoveringLabel = null;
        this._selectedLabels = new Set<Label>();

        this._suggestionEnabled = true;
        this._suggestionLogic = getLabelingSuggestionLogic(LabelingSuggestionLogicType.CURRENT_VIEW);
        this._changePointsEnabled = true;
        this._suggestionConfidenceThreshold = 0.2;
        this._suggestionConfidenceHistogram = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

        // this._isPlaying = false;

        this._labelHoveringListeners = new PerItemEventListeners<Label>();
        this._labelSelectedListeners = new PerItemEventListeners<Label>();

        const nonIgnoreClases = labelingStore.classes.filter((x) => x !== 'IGNORE');
        this._currentClass = nonIgnoreClases.length > 0 ? nonIgnoreClases[0] : null;

        this._isSuggesting = false;
        this._suggestionTimestampStart = null;
        this._suggestionTimestampCompleted = null;
        this._suggestionTimestampEnd = null;

        this._microAdjusterType = 'frame-drag';

        labelingStore.classesChanged.on(this.onClassesChanged.bind(this));
        labelingStore.labelsArrayChanged.on(this.onLabelsArrayChanged.bind(this));

        globalDispatcher.register(action => {
            if (action instanceof actions.CommonActions.UIAction) {
                this.handleUiAction(action);
            }
        });
    }

    // Exposed properties.

    // Which label is being hovered. HOVERING_LABEL_CHANGED
    public get hoveringLabel(): Label { return this._hoveringLabel; }

    // Currently selected class. CURRENT_CLASS_CHANGED
    public get currentClass(): string { return this._currentClass; }
    public set currentClass(className: string) { this._currentClass = className; this.currentClassChanged.emit(); }

    // Selected labels. SELECTED_LABELS_CHANGED
    public get selectedLabels(): Set<Label> { return this._selectedLabels; }

    public get signalsViewMode(): SignalsViewMode { return this._signalsViewMode; }

    // Suggestion logic.
    public get suggestionLogic(): LabelingSuggestionLogic { return this._suggestionLogic; }
    public get suggestionLogicType(): LabelingSuggestionLogicType { return this._suggestionLogic.getType(); }

    public get suggestionConfidenceThreshold(): number { return this._suggestionConfidenceThreshold; }

    public get suggestionEnabled(): boolean { return this._suggestionEnabled; }
    public get changePointsEnabled(): boolean { return this._changePointsEnabled; }

    public get suggestionProgress(): number[] {
        if (!this._isSuggesting) { return null; }
        return [this._suggestionTimestampStart, this._suggestionTimestampCompleted, this._suggestionTimestampEnd];
    }

    public get suggestionConfidenceHistogram(): number[] {
        return this._suggestionConfidenceHistogram;
    }

    public get microAdjusterType(): string { return this._microAdjusterType; }

    private handleUiAction(action: actions.CommonActions.UIAction): void {
        if (action instanceof actions.LabelingActions.HoverLabel) {
            if (this._hoveringLabel !== action.label) {
                const old_label = this._hoveringLabel;
                this._hoveringLabel = action.label;
                if (old_label) {
                    this.labelHoveringChanged.emit(old_label);
                }
                if (this._hoveringLabel) {
                    this.labelHoveringChanged.emit(this._hoveringLabel);
                }
                this.hoveringLabelChanged.emit();
            }
        }
        if (action instanceof actions.LabelingActions.SelectLabel) {
            const previous_selected_labels: Label[] = [];
            this._selectedLabels.forEach((label) => { previous_selected_labels.push(label); });
            this._selectedLabels.clear();
            this._selectedLabels.add(action.label);
            previous_selected_labels.forEach((label) => this.labelSelectionChanged.emit(label));
            this.labelSelectionChanged.emit(action.label);
            this.selectedLabelsChanged.emit();
            // Change current class to label's class.
            this._currentClass = action.label.className;
            this.currentClassChanged.emit();
        }
        if (action instanceof actions.LabelingActions.SelectNextLabel) {
            const previousSelectedLabels: Label[] = [];
            this._selectedLabels.forEach((label) => { previousSelectedLabels.push(label); });
            if (previousSelectedLabels.length === 1) {
                const label = previousSelectedLabels[0];

                // Find the next label.
                const labels = labelingStore.labels.concat(labelingStore.suggestions);
                labels.sort((a, b) => a.timestampStart - b.timestampStart);
                const nextLabelIndex = labels.indexOf(label) + action.advance;

                if (nextLabelIndex >= 0 && nextLabelIndex < labels.length) {
                    this._selectedLabels.clear();
                    this.labelSelectionChanged.emit(label);
                    this._selectedLabels.add(labels[nextLabelIndex]);
                    this.labelSelectionChanged.emit(labels[nextLabelIndex]);
                    this.selectedLabelsChanged.emit();
                    // Change current class to label's class.
                    this._currentClass = labels[nextLabelIndex].className;
                    this.currentClassChanged.emit();
                }
            }
        }
        if (action instanceof actions.LabelingActions.ClearLabelSelection) {
            const previous_selected_labels: Label[] = [];
            this._selectedLabels.forEach((label) => { previous_selected_labels.push(label); });
            this._selectedLabels.clear();
            previous_selected_labels.forEach((label) => this.labelSelectionChanged.emit(label));
            this.selectedLabelsChanged.emit();
        }
        if (action instanceof actions.LabelingActions.SelectClass) {
            // Change current class to label's class.
            if (this._currentClass !== action.className) {
                if (labelingStore.classes.indexOf(action.className) >= 0) {
                    this._currentClass = action.className;
                    this.currentClassChanged.emit();
                }
            }
        }
        if (action instanceof actions.LabelingActions.SetSuggestionProgress) {
            this._isSuggesting = action.suggesting;
            this._suggestionTimestampStart = action.timestampStart;
            this._suggestionTimestampCompleted = action.timestampCompleted;
            this._suggestionTimestampEnd = action.timestampEnd;
            if (action.confidenceHistogram) {
                this._suggestionConfidenceHistogram = action.confidenceHistogram;
            }
            this.suggestionProgressChanged.emit();
        }
        if (action instanceof actions.LabelingActions.SetSuggestionConfidenceThreshold) {
            if (this._suggestionConfidenceThreshold !== action.threshold) {
                this._suggestionConfidenceThreshold = action.threshold;
                this.suggestionConfidenceThresholdChanged.emit();
            }
        }
        if (action instanceof actions.LabelingActions.SetSuggestionEnabled) {
            this._suggestionEnabled = action.enabled;
            this.suggestionEnabledChanged.emit();
        }
        if (action instanceof actions.LabelingActions.SetSuggestionLogic) {
            this._suggestionLogic = getLabelingSuggestionLogic(action.logic);
            this.suggestionLogicChanged.emit();
        }
        if (action instanceof actions.LabelingActions.SetChangePointsEnabled) {
            this._changePointsEnabled = action.enabled;
            this.changePointsEnabledChanged.emit();
        }
        if (action instanceof actions.LabelingActions.SetSignalsViewMode) {
            this._signalsViewMode = action.mode;
            this.signalsViewModeChanged.emit();
        }
        if (action instanceof actions.LabelingActions.RevealSelectedLabel) {
            let selectedLabel: Label = null;
            this.selectedLabels.forEach((l) => selectedLabel = l);
            if (selectedLabel !== null) {
                if (selectedLabel.timestampStart < alignmentLabelingUiStore.referenceViewStart ||
                    selectedLabel.timestampEnd > alignmentLabelingUiStore.referenceViewEnd) {
                    alignmentLabelingUiStore.handleUiAction(
                        new actions.CommonActions.SetReferenceViewZooming(
                            selectedLabel.timestampStart - alignmentLabelingUiStore.referenceViewDuration * 0.2,
                            null, true));
                }
            }
        }
    }

    private onClassesChanged(): void {
        if (labelingStore.classes.indexOf(this._currentClass) < 0) {
            this._currentClass = labelingStore.classes.length > 0 ? labelingStore.classes[0] : null;
            this.currentClassChanged.emit();
        }
    }

    private onLabelsArrayChanged(): void {
        // Remove labels from selection if deleted.
        let deleted_labels = false;
        this._selectedLabels.forEach((label) => {
            if (labelingStore.labels.indexOf(label) < 0) {
                this._selectedLabels.delete(label);
                deleted_labels = true;
            }
        });
        if (deleted_labels) {
            this.selectedLabelsChanged.emit();
        }
    }

    public getLabelsInRange(timestampStart: number, timestampEnd: number): Label[] {
        const labels = labelingStore.getLabelsInRange(timestampStart, timestampEnd);
        return labels.filter((l) => l !== this.hoveringLabel && !this.selectedLabels.has(l)).concat(
            labels.filter((l) => l !== this.hoveringLabel && this.selectedLabels.has(l))).concat(
            labels.filter((l) => l === this.hoveringLabel));
    }

    public isLabelHovered(label: Label): boolean {
        return this.hoveringLabel === label;
    }

    public isLabelSelected(label: Label): boolean {
        return this.selectedLabels.has(label);
    }


    public hoverLabel(label: Label): void {
        new actions.LabelingActions.HoverLabel(label).dispatch();
    }

    public updateLabel(label: Label, newLabel: PartialLabel): void {
        new actions.LabelingActions.UpdateLabel(label, newLabel).dispatch();
    }

    public selectLabel(label: Label, ctrlSelect: boolean = false, shiftSelect: boolean = false): void {
        new actions.LabelingActions.SelectLabel(label, ctrlSelect, shiftSelect).dispatch();
    }

    public removeLabel(label: Label): void {
        new actions.LabelingActions.RemoveLabel(label).dispatch();
    }


    public currentClassChanged: NodeEvent = new NodeEvent(this, 'current-class-changed');
    public hoveringLabelChanged: NodeEvent = new NodeEvent(this, 'hovering-label-changed');
    public selectedLabelsChanged: NodeEvent = new NodeEvent(this, 'selected-labels-changed');
    public signalsViewModeChanged: NodeEvent = new NodeEvent(this, 'signals-view-mode-changed');
    public suggestionProgressChanged: NodeEvent = new NodeEvent(this, 'suggestion-progress-changed');
    public suggestionConfidenceThresholdChanged: NodeEvent = new NodeEvent(this, 'suggestion-confidence-threshold-changed');
    public suggestionEnabledChanged: NodeEvent = new NodeEvent(this, 'suggestion-enabled-changed');
    public suggestionLogicChanged: NodeEvent = new NodeEvent(this, 'suggestion-logic-changed');
    public changePointsEnabledChanged: NodeEvent = new NodeEvent(this, 'change-points-enabled-changed');
    public labelHoveringChanged: NodeItemEvent<Label> = new NodeItemEvent<Label>();
    public labelSelectionChanged: NodeItemEvent<Label> = new NodeItemEvent<Label>();

}
