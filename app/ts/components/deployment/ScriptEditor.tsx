// tslint:disable:no-reference
/// <reference path="../../../../node_modules/monaco-editor/monaco.d.ts" />
// tslint:enable:no-reference
import * as React from 'react';

export interface ScriptEditorProps {
    width: number;
    height: number;
    text: string;
    readOnly: boolean;
}

export class ScriptEditor extends React.Component<ScriptEditorProps, {}> {
    private editor: monaco.editor.IStandaloneCodeEditor;

    public refs: {
        [key: string]: Element,
        container: HTMLElement
    };

    constructor(props: ScriptEditorProps, context: any) {
        super(props, context);
    }

    public componentDidMount(): void {
        const monaco = (global as any).monaco;
        this.editor = monaco.editor.create(this.refs.container, {
            value: '',
            language: 'c',
            lineNumbers: false,
            glyphMargin: false,
            parameterHints: true,
            suggestOnTriggerCharacters: true
        });
    }

    public componentWillReceiveProps(newProps: ScriptEditorProps): void {
        this.editor.getModel().setValue(newProps.text);
        this.editor.updateOptions({ readOnly: newProps.readOnly });
    }

    public render(): JSX.Element {
        return (
            <div className='monaco-container'>
                <div ref='container' className='monaco-toplevel'
                    style={{
                        width: this.props.width,
                        height: this.props.height
                    }}>
                </div>
            </div>
        );
    }
}