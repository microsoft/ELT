// App-level UI Store: Manages the curernt tab.

import { TabID } from '../stores/dataStructures/types';
import { action, observable } from 'mobx';


export class UiStore {
    @observable public currentTab: TabID;
    // Zooming view parameters.
    @observable public viewWidth: number;

    constructor() {
        this.currentTab = 'file';
        this.viewWidth = 800;
    }

    @action
    public switchTab(tab: TabID): void {
        this.currentTab = tab;
    }


    @action
    public setViewWidth(width: number): void {
        this.viewWidth = width;
        // [this.referenceViewStart, this.referenceViewPPS] =
        //     this.constrainDetailedViewZoomingParameters(this.referenceViewStart, this.referenceViewPPS);
    }


}
