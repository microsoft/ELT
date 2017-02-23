import { TabID } from '../stores/dataStructures/types';
import * as stores from '../stores/stores';
import { NavigationColumn, NavigationColumnItem } from './common/NavigationColumn';
import { SharedAlignmentLabelingPane } from './common/SharedAlignmentLabelingPane';
import { HomeMenu } from './home/HomeMenu';
import { remote } from 'electron';
import { observer } from 'mobx-react';
import * as React from 'react';

@observer
export class App extends React.Component<{}, {}> {
    constructor(props: {}, context: any) {
        super(props, context);
        this.onKeyDown = this.onKeyDown.bind(this);
    }

    public componentDidMount(): void {
        window.addEventListener('keydown', this.onKeyDown);
    }

    public componentWillUnmount(): void {
        window.removeEventListener('keydown', this.onKeyDown);
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
                        stores.projectStore.loadProject(fileNames[0]);
                    }
                });
        }
        // Ctrl-S: If we already have a project file, write to it; otherwise prompt for a new one.
        if (event.ctrlKey && event.keyCode === 'S'.charCodeAt(0)) {
            if (stores.projectStore.projectFileLocation) {
                stores.projectStore.saveProject(stores.projectStore.projectFileLocation);
            } else {
                remote.dialog.showSaveDialog(
                    remote.BrowserWindow.getFocusedWindow(),
                    {
                        filters: [{ name: 'Project Metadata', extensions: ['json'] }]
                    },
                    (fileName: string) => {
                        if (fileName) {
                            stores.projectStore.saveProject(fileName);
                        }
                    });
            }
        }
    }

    public render(): JSX.Element {
        const debugging = remote.getGlobal('debugging');
        return (
            <div className='app-container container-fluid'>

                {debugging ?
                    // The following weird construct is to ensure that the devtools
                    // module is only loaded when the debugging flag is true. 
                    // tslint:disable-next-line:no-require-imports
                    (DevTools => <DevTools />)(require('mobx-react-devtools').default) : null}

                <NavigationColumn selected={stores.projectUiStore.currentTab} onSelect={
                    tab => {
                        stores.projectUiStore.currentTab = tab as TabID;
                    }
                }>
                    <NavigationColumnItem title='Home' name='file' iconClass='glyphicon glyphicon-home'>
                        <HomeMenu />
                    </NavigationColumnItem>
                    <NavigationColumnItem title='Alignment' name='alignment' showButton={true} iconClass={'glyphicon glyphicon-time'}>
                        <SharedAlignmentLabelingPane mode='alignment' toolbarHeight={40} />
                    </NavigationColumnItem>
                    <NavigationColumnItem title='Labeling' name='labeling' showButton={true} iconClass={'glyphicon glyphicon-tags'}>
                        <SharedAlignmentLabelingPane mode='labeling' toolbarHeight={40} />
                    </NavigationColumnItem>
                </NavigationColumn>
            </div>
        );
    }
}
