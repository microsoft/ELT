// Labeling actions.

import {SignalsViewMode, Label, PartialLabel} from '../stores/dataStructures/labeling';
import {LabelingSuggestionLogicType} from '../suggestion/LabelingSuggestionLogic';
import {ActionBase} from './ActionBase';
import {CommonActions} from './CommonActions';


export module LabelingActions {

    export class AddLabel extends ActionBase {
        constructor(
            public label: Label
        ) { super(); }
    }

    export class UpdateLabel extends ActionBase {
        constructor(
            public label: Label,
            public newLabel: PartialLabel
        ) { super(); }
    }

    export class RemoveLabel extends ActionBase {
        constructor(
            public label: Label
        ) { super(); }
    }

    export class RemoveAllLabels extends ActionBase {
    }

    export class CreateRandomLabels extends ActionBase {
        constructor(
            public count: number,
            public tmin: number,
            public tmax: number
        ) { super(); }
    }

    export class SuggestLabels extends ActionBase {
        constructor(
            public labels: Label[],
            public timestampStart: number,
            public timestampEnd: number,
            public timestampCompleted: number,
            public generation: number
        ) { super(); }
    }

    export class SuggestChangePoints extends ActionBase {
        constructor(
            public changePoints: number[]
        ) { super(); }
    }

    export class RemoveAllSuggestions extends ActionBase {
    }

    export class ConfirmVisibleSuggestions extends ActionBase {
    }

    export class AddClass extends ActionBase {
        constructor(
            public className: string
        ) { super(); }
    }

    export class RemoveClass extends ActionBase {
        constructor(
            public className: string
        ) { super(); }
    }

    export class RenameClass extends ActionBase {
        constructor(
            public oldClassName: string,
            public newClassName: string
        ) { super(); }
    }

    export class SaveLabels extends ActionBase {
        constructor(
            public filename: string
        ) { super(); }
    }

    export class LoadDataset extends ActionBase {
        constructor(
            public metadataFilename: string
        ) { super(); }
    }

    export class LoadLabels extends ActionBase {
        constructor(
            public filename: string
        ) { super(); }
    }

    // Labeling UI Actions.
    export class HoverLabel extends CommonActions.UIAction {
        constructor(
            public label: Label
        ) { super(); }
    }

    export class SelectLabel extends CommonActions.UIAction {
        constructor(
            public label: Label,
            public ctrlSelect: boolean = false,
            public shiftSelect: boolean = false
        ) { super(); }
    }

    export class SelectNextLabel extends CommonActions.UIAction {
        constructor(
            public advance: number
        ) { super(); }
    }

    export class ClearLabelSelection extends CommonActions.UIAction {

    }

    export class SelectClass extends CommonActions.UIAction {
        constructor(
            public className: string
        ) { super(); }
    }

    export class SetSignalsViewMode extends CommonActions.UIAction {
        constructor(
            public mode: SignalsViewMode
        ) { super(); }
    }

    export class SetSuggestionProgress extends CommonActions.UIAction {
        constructor(
            public suggesting: boolean,
            public timestampStart: number,
            public timestampCompleted: number,
            public timestampEnd: number,
            public confidenceHistogram?: number[]
        ) { super(); }
    }

    export class SetSuggestionConfidenceThreshold extends CommonActions.UIAction {
        constructor(
            public threshold: number
        ) { super(); }
    }

    export class SetSuggestionEnabled extends CommonActions.UIAction {
        constructor(
            public enabled: boolean
        ) { super(); }
    }

    export class SetSuggestionLogic extends CommonActions.UIAction {
        constructor(
            public logic: LabelingSuggestionLogicType
        ) { super(); }
    }

    export class SetChangePointsEnabled extends CommonActions.UIAction {
        constructor(
            public enabled: boolean
        ) { super(); }
    }

    export class RevealSelectedLabel extends CommonActions.UIAction {
        constructor() { super(); }
    }

    export class SetNavigationTab extends CommonActions.UIAction {
        constructor(public tabName: string) { super(); }
    }

}
