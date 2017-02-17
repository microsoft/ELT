import * as stores from '../../stores/stores';
import { OptionsToolbar } from '../common/OptionsToolbar';
import { InlineClassesListView } from './ClassesListView';
import { SuggestionsToolbar } from './SuggestionsToolbar';
import { observer } from 'mobx-react';
import * as React from 'react';


export interface LabelingToolbarProps {
    top: number;
    left: number;
    viewWidth: number;
    viewHeight: number;
}


@observer
export class LabelingToolbar extends React.Component<LabelingToolbarProps, {}> {
    public refs: {
        [name: string]: Element,
        fileSelector: HTMLInputElement
    };

    public render(): JSX.Element {
        return (
            <div className='toolbar-view' style={{
                position: 'absolute',
                top: this.props.top + 'px',
                left: this.props.left + 'px',
                width: this.props.viewWidth + 'px',
                height: this.props.viewHeight + 'px'
            }}>
                <InlineClassesListView />
                <span className='sep' />
                <span>{stores.labelingStore.labels.length} labels.</span>
                <button className='tbtn tbtn-red' title='Delete all labels'
                    onClick={() => {
                        if (confirm('Are you sure to delete all labels?')) {
                            stores.labelingStore.removeAllLabels();
                        }
                    }}>
                    <span className='glyphicon icon-only glyphicon-trash'></span>
                </button>
                <span className='sep' />
                <OptionsToolbar />
                <SuggestionsToolbar />
            </div>
        );
    }
}
