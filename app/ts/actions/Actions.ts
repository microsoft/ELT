// Gather all app actions here.

import {TabID} from '../common/ui/types';
import {ActionBase} from './ActionBase';

export module Actions {

    export class SwitchTabAction extends ActionBase {
        constructor(
            public tab: TabID
        ) { super(); }
    }

}

export { AlignmentActions } from './AlignmentActions';
export { LabelingActions } from './LabelingActions';
export { CommonActions } from './CommonActions';
