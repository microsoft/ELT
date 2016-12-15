// Root action class.

import {globalDispatcher} from '../dispatcher/globalDispatcher';

// The root class for actions.
// - To create a new action, subclass this with your parameters.
// - To dispatch a action, use new YourActionClass(parameters, ...).dispatch();
export class ActionBase {
    // Dispatch this action to the GlobalDispatcher.
    public dispatch(): void {
        globalDispatcher.dispatch(this);
    }
}
