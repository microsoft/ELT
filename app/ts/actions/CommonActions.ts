// Common actions.

import {Track} from '../stores/dataStructures/alignment';
import {ActionBase} from './ActionBase';


export module CommonActions {

    export class UIAction extends ActionBase {
    }

    export class NewProject extends ActionBase {
    }

    // FIXME: These are not hooked up to anything
    export class AlignmentUndo extends ActionBase {
    }
    export class AlignmentRedo extends ActionBase {
    }
    export class LabelingUndo extends ActionBase {
    }
    export class LabelingRedo extends ActionBase {
    }

 

}
