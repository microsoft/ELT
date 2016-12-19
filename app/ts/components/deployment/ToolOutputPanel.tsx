import * as $ from 'jquery';
import * as React from 'react';


export interface ToolOutputPanelProps {
    titleText: string;
    outputText: string;
}

export class ToolOutputPanel extends React.Component<ToolOutputPanelProps, {}> {
    public refs: {
        [key: string]: Element,
        collapser: Element,
    };
    public open(): void {
        if (!$('.panel-collapse').hasClass('in')) {
            ($('.collapse') as any).collapse('toggle');
        }
    }
    public render(): JSX.Element {
        return (
            <div className='panel panel-default toolOutputPanel'>
                <div className='panel-heading'>
                    <div className='panel-title'>
                        <span className='panelTitle'>{this.props.titleText}</span>
                        <a ref='collapser' data-toggle='collapse' data-target='.toolOutput' className='toolOutputPanelCollapse'>
                            <span className='toolOutput collapse in glyphicon glyphicon-collapse-up'></span>
                            <span className='toolOutput collapse glyphicon glyphicon-collapse-down'></span>
                        </a>
                    </div>
                </div>
                <div className='panel-collapse collapse toolOutput'>
                    <div className='feedbackText'>{this.props.outputText}</div>
                </div>
            </div>
        );
    }
}
