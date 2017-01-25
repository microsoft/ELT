import {LabelingSuggestionGenerator} from '../suggestion/LabelingSuggestionGenerator';
import {AlignmentStore} from './AlignmentStore';
import {AlignmentUiStore} from './AlignmentUiStore';
import {DtwModelStore} from './DtwModelStore';
import {LabelingStore} from './LabelingStore';
import {LabelingUiStore} from './LabelingUiStore';
import {ProjectStore} from './ProjectStore';
import {ProjectUiStore} from './ProjectUiStore';

export const projectStore = new ProjectStore();
export const projectUiStore = new ProjectUiStore();
export const alignmentUiStore = new AlignmentUiStore();
export const alignmentStore = new AlignmentStore(projectStore, projectUiStore);
export const labelingStore = new LabelingStore(alignmentStore);
export const labelingUiStore = new LabelingUiStore(labelingStore);
export const dtwModelStore = new DtwModelStore();

export const labelingSuggestionGenerator = new LabelingSuggestionGenerator(labelingStore, labelingUiStore, projectUiStore);
