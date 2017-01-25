import {LabelingSuggestionGenerator} from '../suggestion/LabelingSuggestionGenerator';
import {AlignmentLabelingStore} from './AlignmentLabelingStore';
import {AlignmentLabelingUiStore} from './AlignmentLabelingUiStore';
import {AlignmentStore} from './AlignmentStore';
import {AlignmentUiStore} from './AlignmentUiStore';
import {DtwModelStore} from './DtwModelStore';
import {LabelingStore} from './LabelingStore';
import {LabelingUiStore} from './LabelingUiStore';
import {UiStore} from './UiStore';

export const alignmentLabelingStore = new AlignmentLabelingStore();
export const alignmentLabelingUiStore = new AlignmentLabelingUiStore();
export const alignmentUiStore = new AlignmentUiStore();
export const uiStore = new UiStore();
export const alignmentStore = new AlignmentStore(alignmentLabelingStore, alignmentLabelingUiStore);
export const labelingStore = new LabelingStore(alignmentStore, uiStore);
export const labelingUiStore = new LabelingUiStore(labelingStore);
export const dtwModelStore = new DtwModelStore();

export const labelingSuggestionGenerator = new LabelingSuggestionGenerator(labelingStore, labelingUiStore, alignmentLabelingUiStore);
