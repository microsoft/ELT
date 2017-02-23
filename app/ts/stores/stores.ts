import {AlignmentStore} from './AlignmentStore';
import {LabelingStore} from './LabelingStore';
import {LabelingUiStore} from './LabelingUiStore';
import {ProjectStore} from './ProjectStore';
import {ProjectUiStore} from './ProjectUiStore';

export const projectStore = new ProjectStore();
export const alignmentStore = new AlignmentStore();
export const projectUiStore = new ProjectUiStore(projectStore);
export const labelingStore = new LabelingStore(alignmentStore);
export const labelingUiStore = new LabelingUiStore(labelingStore);
