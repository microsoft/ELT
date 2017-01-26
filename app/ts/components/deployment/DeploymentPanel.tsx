import { LayoutParameters } from '../../stores/dataStructures/LayoutParameters';
import * as stores from '../../stores/stores';
import { labelingSuggestionGenerator } from '../../stores/stores';
import { generateEllModel } from '../../suggestion/ELLDtwModelGeneration';
import { DeploymentToolbar } from './DeploymentToolbar';
import { ScriptEditor } from './ScriptEditor';
import { ToolOutputPanel } from './ToolOutputPanel';
import { execFileSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as React from 'react';


// Configuration
const useEllModel = true; // vs. Donghao model
const confidenceThreshold = 0.2;
const useStoredModel = false;

// utility function for copying file
function copyTextFile(sourceFilename: string, targetFilename: string): void {
    const text = fs.readFileSync(sourceFilename, 'utf-8');
    fs.writeFileSync(targetFilename, text);
}

interface Tab {
    isReadOnly: boolean;
    label: string;
    text: string;
}

interface DeploymentPanelState {
    arduinoAppCodeTemplate?: string;
    arduinoModelCode?: string;
    microbitAppCodeTemplate?: string;
    microbitModelCode?: string;
    width?: number;
    height?: number;
    tabs?: Tab[];
    currentTab?: Tab;
    toolOutput?: string;
}

export class DeploymentPanel extends React.Component<{}, DeploymentPanelState> {
    public refs: {
        [key: string]: Element,
        container: Element,
    };

    private toolOutputPanel: ToolOutputPanel;

    constructor() {
        super();
        let appCode: string;
        let modelCodeFilename: string;
        if (useEllModel) {
            appCode = fs.readFileSync('arduino/dtw_ELL.ino', 'utf-8');
            modelCodeFilename = 'model.asm';
        } else {
            appCode = fs.readFileSync('arduino/dtw.ino', 'utf-8');
            modelCodeFilename = 'model.ino';
        }
        // let appCode = fs.readFileSync('arduino/dtw_TEST.ino', 'utf-8');
        const tabs = [
            {
                label: 'dtw.ino',
                isReadOnly: false,
                text: appCode
            },
            {
                label: modelCodeFilename,
                isReadOnly: true,
                text: ''
            }
        ];
        this.state = {
            arduinoAppCodeTemplate: appCode,
            arduinoModelCode: '',
            microbitAppCodeTemplate: appCode,
            microbitModelCode: '',
            tabs: tabs,
            currentTab: tabs[0],
            toolOutput: ''
        };
        this.compile = this.compile.bind(this);
        this.deploy = this.deploy.bind(this);
    }

    public componentDidMount(): void {
        const prototypes = stores.dtwModelStore.prototypes;
        if (prototypes.length === 0) { return; }
        const sampleRate = stores.dtwModelStore.prototypeSampleRate;
        const model = generateEllModel(sampleRate, 30, prototypes, confidenceThreshold);
        const ellModelCode = model.GetCodeString();
        const header = model.GetHeaderString();
        labelingSuggestionGenerator.getDeploymentCode('arduino', oldModelCode => {
            const modelCode = useEllModel ? ellModelCode : oldModelCode;
            // #### hack: replace code passed in with current code from the store
            const appCode = this.state.arduinoAppCodeTemplate.replace('// %%HEADER%%', header);
            this.setState({ arduinoModelCode: modelCode });
            const modelCodeFilename = useEllModel ? 'model.asm' : 'model.ino';
            this.state.tabs
                .filter(t => t.label === modelCodeFilename)
                .forEach(t => t.text = modelCode);
            this.state.tabs
                .filter(t => t.label === 'dtw.ino')
                .forEach(t => t.text = appCode);
        });
        labelingSuggestionGenerator.getDeploymentCode('microbit', oldModelCode => {
            const modelCode = useEllModel ? ellModelCode : oldModelCode;
            // #### hack: replace code passed in with current code from the store
            // let appCode = this.state.microbitAppCodeTemplate.replace('// %%HEADER%%', header);
            this.setState({ microbitModelCode: modelCode });
            // TODO: set code tabs
        });
        const containerWidth = this.refs.container.getBoundingClientRect().width;
        const containerHeight = 500; // this.refs.container.getBoundingClientRect().height;
        this.setState({ width: containerWidth, height: containerHeight });
    }

    private compile(): void {
        this.runScript('--verify');
    }

    private deploy(): void {
        this.runScript('--upload');
    }

    private runScript(mode: string): void {
        // Create a temp sketch with our files.
        const mainTempDir = os.tmpdir() + path.sep + 'DTWSketches';
        if (!fs.existsSync(mainTempDir)) {
            fs.mkdirSync(mainTempDir);
        }
        const topdir = fs.mkdtempSync(os.tmpdir() + path.sep + 'DTWSketches' + path.sep + 'sketch-');
        const tmpdir = topdir + path.sep + 'dtw';
        fs.mkdirSync(tmpdir);
        copyTextFile('arduino/BluefruitConfig.h', tmpdir + path.sep + 'BluefruitConfig.h');
        this.state.tabs.forEach(tab => {
            const filename = tab.label;
            const asmExt = '.asm';
            if (filename.indexOf(asmExt, filename.length - asmExt.length) !== -1) {
                if (useStoredModel) {
                    copyTextFile('arduino/model.asm', tmpdir + path.sep + filename);
                } else {
                    fs.writeFileSync(tmpdir + path.sep + filename, tab.text);
                }
                const llcArgs = [
                    '-mtriple=armv6m-unknown-none-eabi',
                    '-march=thumb -mcpu=cortex-m0',
                    '-float-abi=soft',
                    '-mattr=+armv6-m,+v6m',
                    '-filetype=asm -asm-verbose=0',
                    '-o=model.S',
                    'model.asm'
                ];
                const cmdOutput = execFileSync('llc', llcArgs, { cwd: tmpdir });
            } else {
                fs.writeFileSync(tmpdir + path.sep + tab.label, tab.text);
            }
        });
        this.setState({ toolOutput: '' });
        // Run the arduino command line tool.
        const arduinoCmd = 'C:\\Program Files (x86)\\Arduino\\arduino_debug.exe';
        const board = 'adafruit:samd:adafruit_feather_m0';
        const port = 'COM8';
        const proc = spawn(
            arduinoCmd,
            [mode, 'dtw.ino', '--board', board, '--port', port, '--verbose-upload'],
            { cwd: tmpdir });
        const report = (line: string, isError: boolean) => {
            this.setState({ toolOutput: this.state.toolOutput + line });
        };
        proc.stdout.on('data', data => report(data.toString(), false));
        proc.stderr.on('data', data => report(data.toString(), true));
        proc.on('close', (m) => report('Done', false));
        this.toolOutputPanel.open();
    }


    public render(): JSX.Element {
        return (
            <div ref='container'>
                <div className='app-menu deployment-menu'>
                    <DeploymentToolbar
                        top={0}
                        left={0}
                        viewWidth={this.state.width}
                        viewHeight={LayoutParameters.toolbarViewHeight}
                        compileClick={this.compile}
                        deployClick={this.deploy} />
                </div>
                <ul className='nav nav-tabs'>
                    {
                        this.state.tabs.map((tab, i) =>
                            <li className={tab.label === this.state.currentTab.label ? 'active' : ''}
                                key={tab.label}>
                                <a onClick={() => this.setState({ currentTab: tab })} href='#'>
                                    {tab.label}
                                </a>
                            </li>)
                    }
                </ul>
                <ScriptEditor
                    width={this.state.width}
                    height={this.state.height}
                    text={this.state.currentTab.text}
                    readOnly={this.state.currentTab.isReadOnly} />
                <ToolOutputPanel ref={e => this.toolOutputPanel = e}
                    titleText='Deployment Output'
                    outputText={this.state.toolOutput} />
            </div>
        );
    }
}
