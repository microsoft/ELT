// The main view for the app.

import * as Actions from '../actions/Actions';
import { TabID } from '../stores/dataStructures/types';
import * as stores from '../stores/stores';
import { EventListenerComponent } from './common/EventListenerComponent';
import { NavigationColumn, NavigationColumnItem } from './common/NavigationColumn';
import { DeploymentPanel } from './deployment/DeploymentPanel';
import { HomeMenu } from './menus/HomeMenu';
import { OptionsMenu } from './menus/OptionsMenu';
import { WorkPanel } from './WorkPanel';
import { remote } from 'electron';
import * as React from 'react';
import {observer} from 'mobx-react';

export interface AppState {
    currentTab: string;
}

// Labeling app has some configuration code, then it calls LabelingView.
@observer
export class App extends React.Component<{}, AppState> {
    constructor(props: {}, context: any) {
        super(props, context);

        this.state = {
            currentTab: stores.uiStore.currentTab
        };

        this.updateState = this.updateState.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
    }

    public componentDidMount(): void {
        window.addEventListener('keydown', this.onKeyDown);
    }

    public componentWillUnmount(): void {
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
                        stores.alignmentLabelingStore.loadProject(fileNames[0]);
                    }
                });
        }
        // Ctrl-S: If we already have a project file, write to it; otherwise prompt for a new one.
        if (event.ctrlKey && event.keyCode === 'S'.charCodeAt(0)) {
            if (stores.alignmentLabelingStore.projectFileLocation) {
                stores.alignmentLabelingStore.saveProject(stores.alignmentLabelingStore.projectFileLocation);
            } else {
                remote.dialog.showSaveDialog(
                    remote.BrowserWindow.getFocusedWindow(),
                    {
                        filters: [{ name: 'Project Metadata', extensions: ['json'] }]
                    },
                    (fileName: string) => {
                        if (fileName) {
                            stores.alignmentLabelingStore.saveProject(fileName);
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
                        stores.uiStore.switchTab(tab as TabID);
                    }
                }>
                    <NavigationColumnItem title='Home' name='file' iconClass='glyphicon glyphicon-home'>
                        <HomeMenu />
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
