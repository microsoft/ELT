// App-level UI Store: Manages the curernt tab.

import {Actions} from '../actions/Actions';
import {TabID} from '../common/ui/types';
import {globalDispatcher} from '../dispatcher/globalDispatcher';
import {NodeEvent} from './NodeEvent';
import {EventEmitter} from 'events';




export class UiStore extends EventEmitter {
    private _currentTab: TabID;

    constructor() {
        super();

        this._currentTab = 'file';

        globalDispatcher.register(action => {
            if (action instanceof Actions.SwitchTabAction) {
                this._currentTab = action.tab;
                this.tabChanged.emit();
            }
        });
    }

    public get currentTab(): TabID {
        return this._currentTab;
    }
    public set currentTab(tab: TabID) {
        this._currentTab = tab;
        this.tabChanged.emit();
    }

    public tabChanged: NodeEvent = new NodeEvent(this, 'tab-changed');
}
