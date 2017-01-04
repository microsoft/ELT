// The main view for the app.

import * as Actions from '../actions/Actions';
import { TabID } from '../stores/dataStructures/types';
import * as stores from '../stores/stores';
import { EventListenerComponent } from './common/EventListenerComponent';
import { NavigationColumn, NavigationColumnItem } from './common/NavigationColumn';
import { DeploymentPanel } from './deployment/DeploymentPanel';
import { FileMenu, OptionsMenu } from './menus/menus';
import { WorkPanel } from './WorkPanel';
import { remote } from 'electron';
import * as React from 'react';


export interface AppState {
    currentTab: string;
}

// Labeling app has some configuration code, then it calls LabelingView.
export class App extends EventListenerComponent<{}, AppState> {
    constructor(props: {}, context: any) {
        super(props, context, [stores.uiStore.tabChanged]);

        this.state = {
            currentTab: stores.uiStore.currentTab
        };

        this.updateState = this.updateState.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
    }


    public componentDidMount(): void {
        super.componentDidMount();
        window.addEventListener('keydown', this.onKeyDown);
    }

    public componentWillUnmount(): void {
        super.componentWillUnmount();
        window.removeEventListener('keydown', this.onKeyDown);
    }

    protected updateState(): void {
        this.setState({
            currentTab: stores.uiStore.currentTab
        });
    }

    private onKeyDown(event: KeyboardEvent): void {
        // Open a project.
        if (event.ctrlKey && event.keyCode === 'O'.charCodeAt(0)) {
            remote.dialog.showOpenDialog(
                remote.BrowserWindow.getFocusedWindow(),
                {
                    properties: ['openFile'],
                    filters: [{ name: 'Project Metadata', extensions: ['json'] }]
                },
                (fileNames: string[]) => {
                    if (fileNames && fileNames.length === 1) {
                        new Actions.CommonActions.LoadProject(fileNames[0]).dispatch();
                    }
                });
        }
        // Ctrl-S: If we already have a project file, write to it; otherwise prompt for a new one.
        if (event.ctrlKey && event.keyCode === 'S'.charCodeAt(0)) {
            if (stores.alignmentLabelingStore.projectFileLocation) {
                new Actions.CommonActions.SaveProject(stores.alignmentLabelingStore.projectFileLocation).dispatch();
            } else {
                remote.dialog.showSaveDialog(
                    remote.BrowserWindow.getFocusedWindow(),
                    {
                        filters: [{ name: 'Project Metadata', extensions: ['json'] }]
                    },
                    (fileName: string) => {
                        if (fileName) {
                            new Actions.CommonActions.SaveProject(fileName).dispatch();
                        }
                    });
            }
        }
    }

    public render(): JSX.Element {
        return (
            <div className='app-container container-fluid'>
                <NavigationColumn selected={this.state.currentTab} onSelect={
                    tab => {
                        new Actions.Actions.SwitchTabAction(tab as TabID).dispatch();
                    }
                }>
                    <NavigationColumnItem title='Home' name='file' iconClass='glyphicon glyphicon-home'>
                        <FileMenu />
                    </NavigationColumnItem>
                    <NavigationColumnItem title='Alignment' name='alignment' showButton={true} iconClass={'glyphicon glyphicon-time'}>
                        <WorkPanel mode='alignment' />
                    </NavigationColumnItem>
                    <NavigationColumnItem title='Labeling' name='labeling' showButton={true} iconClass={'glyphicon glyphicon-tags'}>
                        <WorkPanel mode='labeling' />
                    </NavigationColumnItem>
                    <NavigationColumnItem title='Deployment' name='deploying' iconClass='glyphicon glyphicon-export'>
                        <DeploymentPanel />
                    </NavigationColumnItem>
                    <NavigationColumnItem title='Options' name='options' iconClass='glyphicon glyphicon-cog'>
                        <OptionsMenu />
                    </NavigationColumnItem>
                </NavigationColumn>
            </div>
        );
    }
}
