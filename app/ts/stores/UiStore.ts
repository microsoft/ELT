// App-level UI Store: Manages the curernt tab.

import { TabID } from '../stores/dataStructures/types';
import { action, observable } from 'mobx';


export class UiStore {
    @observable public currentTab: TabID;

    constructor() {
        this.currentTab = 'file';
    }

    @action
    public switchTab(tab: TabID): void {
        this.currentTab = tab;
    }

}
