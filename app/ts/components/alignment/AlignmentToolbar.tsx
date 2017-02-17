// Alignment toolbar view.
// - Toolbar buttons for alignment.
import { projectStore} from '../../stores/stores';
import { OptionsToolbar } from '../common/OptionsToolbar';
import { remote } from 'electron';
import { observer } from 'mobx-react';
import * as React from 'react';


export interface AlignmentToolbarProps {
    top: number;
    left: number;
    viewWidth: number;
    viewHeight: number;
}

@observer
export class AlignmentToolbar extends React.Component<AlignmentToolbarProps, {}> {
    public refs: {
        [name: string]: Element
    };

    constructor(props: AlignmentToolbarProps, context: any) {
        super(props, context);
        this.loadDataOrVideo = this.loadDataOrVideo.bind(this);
        this.loadReferenceVideo = this.loadReferenceVideo.bind(this);
    }

    private loadReferenceVideo(): void {
        remote.dialog.showOpenDialog(
            remote.BrowserWindow.getFocusedWindow(),
            {
                properties: ['openFile'],
                filters: [
                    { name: 'WebM videos', extensions: ['webm'] },
                    { name: 'Other supported videos', extensions: ['mp4', 'mov'] }
                ]
            },
            (fileNames: string[]) => {
                if (fileNames && fileNames.length === 1) {
                    projectStore.loadReferenceTrack(fileNames[0]);
                }
            });
    }

    private loadDataOrVideo(): void {
        remote.dialog.showOpenDialog(
            remote.BrowserWindow.getFocusedWindow(),
            {
                properties: ['openFile'],
                filters: [
                    { name: 'Sensor data', extensions: ['tsv'] },
                    { name: 'WebM videos', extensions: ['webm'] },
                    { name: 'Other supported videos', extensions: ['mp4', 'mov'] }
                ]
            },
            (fileNames: string[]) => {
                if (fileNames && fileNames.length === 1) {
                    if (fileNames[0].match(/\.tsv$/i)) {
                        projectStore.loadSensorTrack(fileNames[0]);
                    }
                    if (fileNames[0].match(/\.(webm|mp4|mov)$/i)) {
                        projectStore.loadVideoTrack(fileNames[0]);
                    }
                }
            });
    }

    public render(): JSX.Element {
        return (
            <div className='toolbar-view' style={{
                position: 'absolute',
                top: this.props.top + 'px',
                left: this.props.left + 'px',
                width: this.props.viewWidth + 'px',
                height: this.props.viewHeight + 'px'
            }}>
                <button className='tbtn tbtn-l1'
                    title='Load/replace the reference track'
                    onClick={this.loadReferenceVideo}>
                    <span className='glyphicon glyphicon-folder-open'></span>Load Reference Video...
                </button>
                <button className='tbtn tbtn-l1'
                    title='Load a sensor track from collected data'
                    onClick={this.loadDataOrVideo}>
                    <span className='glyphicon glyphicon-folder-open'></span>Load Video or Sensor...
                </button>
                 <OptionsToolbar />
            </div>
        );
    }
}
