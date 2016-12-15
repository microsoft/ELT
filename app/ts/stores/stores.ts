import {AlignmentLabelingStore} from './AlignmentLabelingStore';
import {AlignmentLabelingUiStore} from './AlignmentLabelingUiStore';
import {AlignmentStore} from './AlignmentStore';
import {AlignmentUiStore} from './AlignmentUiStore';
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
