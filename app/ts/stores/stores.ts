import {LabelingSuggestionGenerator} from '../suggestion/LabelingSuggestionGenerator';
import {AlignmentStore} from './AlignmentStore';
import {DtwModelStore} from './DtwModelStore';
import {LabelingStore} from './LabelingStore';
import {LabelingUiStore} from './LabelingUiStore';
import {ProjectStore} from './ProjectStore';
import {ProjectUiStore} from './ProjectUiStore';

export const projectStore = new ProjectStore();
export const alignmentStore = new AlignmentStore();
export const projectUiStore = new ProjectUiStore(projectStore);
export const labelingStore = new LabelingStore(alignmentStore);
export const labelingUiStore = new LabelingUiStore(labelingStore);
export const dtwModelStore = new DtwModelStore();

export const labelingSuggestionGenerator = new LabelingSuggestionGenerator(labelingStore, labelingUiStore, projectUiStore);
