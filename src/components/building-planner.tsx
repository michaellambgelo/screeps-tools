import * as React from 'react';
import {Container, Row, Col, Input, Label, FormFeedback, Modal, ModalHeader, ModalBody, ModalFooter} from 'reactstrap';
import Select, {OptionTypeBase} from 'react-select';
import * as _ from 'lodash';
import * as LZString from 'lz-string';
import * as Constants from './constants';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faCloudUploadAlt, faShareAlt} from '@fortawesome/free-solid-svg-icons';

interface TerrainMap {
    [y: number]: {
        [x: number]: number
    }
}

const screepsWorlds: {[key: string]: string} = {
    mmo: 'Persistent',
    season: 'Seasonal',
};

export class BuildingPlanner extends React.Component {
    state: Readonly<{
        room: string;
        world: string;
        shard: string;
        terrain: TerrainMap;
        x: number;
        y: number;
        worlds: {[worldName: string]: {shards: string[]}};
        brush: string;
        brushLabel: React.ReactElement | null;
        rcl: number;
        structures: {[structure: string]: {x: number; y: number;}[]};
        sources: {x: number; y: number;}[];
        mineral: {[mineralType: string]: {x: number; y: number;}};
    }>;

    constructor(props: any) {
        super(props);

        let terrain: TerrainMap = {};

        for (let y = 0; y < 50; y++) {
            terrain[y] = {};
            for (let x = 0; x < 50; x++) {
                terrain[y][x] = 0;
            }
        }

        this.state = {
            room: '',
            world: 'mmo',
            shard: 'shard0',
            terrain: terrain,
            x: 0,
            y: 0,
            worlds: {
                mmo: {
                    shards: []
                }
            },
            brush: 'spawn',
            brushLabel: null,
            rcl: 8,
            structures: {},
            sources: [],
            mineral: {}
        };
    }

    componentDidMount() {
        const component = this;

        for (const world in screepsWorlds) {
            fetch(`/api/shards/${world}`).then((response) => {
                response.json().then((data: any) => {
                    if (!data || Object.keys(data).length === 0) {
                        return;
                    }
                    const shards: string[] = [];
                    data.shards.forEach((shard: {name: string}) => {
                        shards.push(shard.name);
                    });
                    component.setState({
                        worlds: {
                            ...this.state.worlds,
                            [world]: {
                                shards: shards
                            }
                        }
                    });
                });
            });
        }

        let params = location.href.split('?')[1];
        let searchParams = new URLSearchParams(params);

        if (searchParams.get('share')) {
            let json = LZString.decompressFromEncodedURIComponent(searchParams.get('share')!);
            if (json) {
                this.loadJson(JSON.parse(json));
            }
        }
    }

    loadJson(json: any) {
        const component = this;

        if (json.shard && json.name) {
            let world = 'mmo';
            if (json.world && json.world === 'season') {
                world = 'season';
            }
            fetch(`/api/terrain/${world}/${json.shard}/${json.name}`).then((response) => {
                response.json().then((data: any) => {
                    let terrain = data.terrain[0].terrain;
                    let terrainMap: TerrainMap = {};
                    for (var y = 0; y < 50; y++) {
                        terrainMap[y] = {};
                        for (var x = 0; x < 50; x++) {
                            let code = terrain.charAt(y * 50 + x);
                            terrainMap[y][x] = code;
                        }
                    }

                    component.setState({terrain: terrainMap});
                });
            });
        }

        let structures: {
            [structure: string]: Array<{
                x: number;
                y: number;
            }>
        } = {};

        Object.keys(json.buildings).forEach((structure) => {
            structures[structure] = json.buildings[structure].pos;
        });

        component.setState({
            room: json.name,
            world: json.world,
            shard: json.shard,
            rcl: json.rcl,
            structures: structures
        });   
    }

    addStructure(x: number, y: number) {
        let structures = this.state.structures;
        let added = false;

        if (Constants.CONTROLLER_STRUCTURES[this.state.brush][this.state.rcl] && x > 0 && x < 49 && y > 0 && y < 49) {
            if (!structures[this.state.brush]) {
                structures[this.state.brush] = [];
            }

            if (structures[this.state.brush].length < Constants.CONTROLLER_STRUCTURES[this.state.brush][this.state.rcl]) {
                
                let foundAtPos = false;

                if (structures[this.state.brush].length > 0) {
                    foundAtPos = _.filter(structures[this.state.brush], (pos) => {
                        return pos.x === x && pos.y === y;
                    }).length > 0;
                }

                if (!foundAtPos) {
                    structures[this.state.brush].push({
                        x: x,
                        y: y
                    });
                    added = true;
                }
            }
        }

        this.setState({structures: structures});
        return added;
    }

    removeStructure(x: number, y: number, structure: string | null) {
        let structures = this.state.structures;

        if (structure == 'controller') {
            // keep these structures, only reimport or reload page can remove them
            return;
        }

        if (structure && structures[structure]) {
            structures[structure] = _.filter(structures[structure], (pos) => {
                return !(pos.x === x && pos.y === y);
            })
        }

        this.setState({structures: structures});
    }

    getRoadProps(x: number, y: number) {
        let roadProps = {
            middle: false,
            top: false,
            top_right: false,
            right: false,
            bottom_right: false,
            bottom: false,
            bottom_left: false,
            left: false,
            top_left: false
        };
        if (this.isRoad(x,y)) {
            roadProps.middle = true;
            for (let rx of [-1, 0, 1]) {
                for (let ry of [-1, 0, 1]) {
                    if (rx === 0 && ry === 0) continue;
                    if (this.isRoad(x + rx, y + ry)) {
                        if (rx === -1 && ry === -1) {
                            roadProps.top_left = true;
                        } else if (rx === 0 && ry === -1) {
                            roadProps.top = true;
                        } else if (rx === 1 && ry === -1) {
                            roadProps.top_right = true;
                        } else if (rx === 1 && ry === 0) {
                            roadProps.right = true;
                        } else if (rx === 1 && ry === 1) {
                            roadProps.bottom_right = true;
                        } else if (rx === 0 && ry === 1) {
                            roadProps.bottom = true;
                        } else if (rx === -1 && ry === 1) {
                            roadProps.bottom_left = true;
                        } else if (rx === -1 && ry === 0) {
                            roadProps.left = true;
                        }
                    }
                }
            }
        }
        return roadProps;
    }

    getStructure(x: number, y: number): string | null {
        let structure = null;
        Object.keys(this.state.structures).forEach((structureName) => {
            if (structureName != 'road' && structureName != 'rampart') {
                this.state.structures[structureName].forEach((pos) => {
                    if (pos.x === x && pos.y === y) {
                        structure = structureName;
                    }
                });
            }
        });
        return structure;
    }

    isRoad(x: number, y: number) {
        let road = false;
        if (this.state.structures.road) {
            this.state.structures.road.forEach((pos) => {
                if (pos.x === x && pos.y === y) {
                    road = true;
                }
            });
        }
        return road;
    }

    isRampart(x: number, y: number) {
        let rampart = false;
        if (this.state.structures.rampart) {
            this.state.structures.rampart.forEach((pos) => {
                if (pos.x === x && pos.y === y) {
                    rampart = true;
                }
            });
        }
        return rampart;
    }

    hasSource(x: number, y: number) {
        let source = false;
        if (this.state.sources) {
            this.state.sources.forEach((pos) => {
                if (pos.x === x && pos.y === y) {
                    source = true;
                }
            });
        }
        return source;
    }

    getMineral(x: number, y: number): string | null {
        const minerals = ['X', 'Z', 'L', 'K', 'U', 'O', 'H'];
        for (let key of minerals) {
            if (this.state.mineral[key]) {
                let mineral = this.state.mineral[key];
                if (mineral.x === x && mineral.y === y) {
                    return key;
                }
            }
        }
        return null;
    }

    getSelectedBrush() {
        const selected: OptionTypeBase = {
            value: this.state.brush,
            label: this.getStructureBrushLabel(this.state.brush)
        };
        return selected;
    }

    getStructureBrushes() {
        const options: OptionTypeBase[] = [];
        Object.keys(Constants.STRUCTURES).map(key => {
            let props: OptionTypeBase = {
                value: key,
                label: this.getStructureBrushLabel(key)
            };
            if (this.getStructureDisabled(key)) {
                props.isDisabled = true;
            }
            options.push(props);
        });
        return options;
    }

    getStructureDisabled(key: string) {
        const total = Constants.CONTROLLER_STRUCTURES[key][this.state.rcl];
        if (total === 0) {
            return true;
        }
        const placed = this.state.structures[key] ? this.state.structures[key].length : 0;
        if (placed === total) {
            return true;
        }
        return false;
    }

    getStructureBrushLabel(key: string) {
        const structure = Constants.STRUCTURES[key];
        const placed = this.state.structures[key] ? this.state.structures[key].length : 0;
        const total = Constants.CONTROLLER_STRUCTURES[key][this.state.rcl];
        return (
            <div>
                <img src={`/static/assets/structures/${key}.png`} />{' '}
                {structure}
                <span className="right">{placed}/{total}</span>
            </div>
        );
    }

    getRCLOptions() {
        const options: OptionTypeBase[] = [];
        const roomLevels = Array.from(Array(8), (_, x) => ++x);
        roomLevels.map(key => {
            options.push({
                value: key,
                label: `RCL ${key}`
            });
        });
        return options;
    }

    getSelectedRCL(): OptionTypeBase {
        return {
            value: this.state.rcl,
            label: `RCL ${this.state.rcl}`
        };
    }

    render() {        
        return (
            <div className="building-planner">
                <Container className="controls" fluid={true}>
                    <Container>
                        <Row className="justify-content-center">
                            {/* 
                                <button className="burger-menu" onClick={() => this.openOrCloseMenu()}>
                                    <div /><div /><div />
                                </button>
                            */}
                            <Col xs={'auto'}>
                                <Select
                                    defaultValue={this.state.brush}
                                    value={this.getSelectedBrush()}
                                    options={this.getStructureBrushes()}
                                    onChange={(selected) => this.setState({brush: selected.value})}
                                    className="select-structure"
                                    classNamePrefix="select"
                                />
                            </Col>
                            <Col xs={'auto'}>
                                <Select
                                    defaultValue={this.state.brush}
                                    value={this.getSelectedRCL()}
                                    options={this.getRCLOptions()}
                                    onChange={(selected) => this.setState({rcl: selected.value})}
                                    className="select-rcl"
                                    classNamePrefix="select"
                                />
                            </Col>
                            <Col xs={'auto'}>
                                <ModalImportRoomForm
                                    planner={this}
                                    room={this.state.room}
                                    shard={this.state.shard}
                                    world={this.state.world}
                                    worlds={this.state.worlds}
                                    modal={false}
                                />
                            </Col>
                            <Col xs={'auto'}>
                                <ModalJson
                                    planner={this}
                                    modal={false}
                                />
                            </Col>
                            <Col xs={'auto'} className="sm-hidden">
                                <button className="btn btn-secondary cursor-pos disabled" title="Cursor Position">
                                    X: {this.state.x} Y: {this.state.y}
                                </button>
                            </Col>
                        </Row>
                    </Container>
                </Container>
                <div className="map">
                    {[...Array(50)].map((ykey, y: number) => {
                        return <div className="flex-row">
                            {[...Array(50)].map((xkey, x: number) => {
                                return <MapCell
                                    x={x}
                                    y={y}
                                    terrain={this.state.terrain[y][x]}
                                    parent={this}
                                    structure={this.getStructure(x, y)}
                                    road={this.getRoadProps(x, y)}
                                    rampart={this.isRampart(x, y)}
                                    source={this.hasSource(x, y)}
                                    mineral={this.getMineral(x, y)}
                                    key={'mc-'+ x + '-' + y}
                                />
                            })}
                        </div>
                    })}
                </div>
            </div>
        );
    }
}

/**
 * Map Cell
 */
interface MapCellProps {
    x: number;
    y: number;
    terrain: number;
    parent: BuildingPlanner;
    structure: string | null;
    road: {
        middle: boolean;
        top: boolean;
        top_right: boolean;
        right: boolean;
        bottom_right: boolean;
        bottom: boolean;
        bottom_left: boolean;
        left: boolean;
        top_left: boolean;
    };
    rampart: boolean;
    source: boolean;
    mineral: string | null;
}

class MapCell extends React.Component<MapCellProps> {
    state: Readonly<{
        hover: boolean;
        structure: string | null;
        road: {
            middle: boolean;
            top: boolean;
            top_right: boolean;
            right: boolean;
            bottom_right: boolean;
            bottom: boolean;
            bottom_left: boolean;
            left: boolean;
            top_left: boolean;
        };
        rampart: boolean;
        source: boolean;
        mineral: string | null;
    }>;

    constructor(props: MapCellProps) {
        super(props);

        this.state = {
            hover: false,
            structure: this.props.structure,
            road: {
                middle: this.props.road.middle,
                top: this.props.road.top,
                top_right: this.props.road.top_right,
                right: this.props.road.right,
                bottom_right: this.props.road.bottom_right,
                bottom: this.props.road.bottom,
                bottom_left: this.props.road.bottom_left,
                left: this.props.road.left,
                top_left: this.props.road.top_left,
            },
            rampart: this.props.rampart,
            source: this.props.source,
            mineral: this.props.mineral
        };
    }

    componentWillReceiveProps(newProps: MapCellProps) {
        this.setState({
            structure: newProps.structure,
            road: newProps.road,
            rampart: newProps.rampart,
            source: newProps.source,
            mineral: newProps.mineral
        });
    }

    getCellContent() {
        let content = [];

        switch (this.state.structure) {
            case 'spawn':
            case 'extension':
            case 'link':
            case 'constructedWall':
            case 'tower':
            case 'observer':
            case 'powerSpawn':
            case 'extractor':
            case 'terminal':
            case 'lab':
            case 'container':
            case 'nuker':
            case 'storage':
            case 'factory':
            case 'controller':
            case 'source':
                let path = `/static/assets/structures/${this.state.structure}.png`;
                content.push(<img src={path} />);
        }

        if (this.state.source) {
            content.push(<img src="/static/assets/resources/source.png" />);
        }

        switch(this.state.mineral) {
            case 'X':
            case 'Z':
            case 'L':
            case 'K':
            case 'U':
            case 'O':
            case 'H':
                let path = `/static/assets/resources/${this.state.mineral}.png`;
                content.push(<img src={path} />);
        }

        if (this.state.road.middle) {
            content.push(<svg height="2%" width="100%">
                <circle cx="50%" cy="50%" r="1" fill="#6b6b6b" />
            </svg>);
        }
        if (this.state.road.top_left) {
            content.push(<svg height="2%" width="100%">
                <line x1="0" y1="0" x2="50%" y2="50%" stroke="#6b6b6b" strokeWidth={2} />
            </svg>);
        }
        if (this.state.road.top) {
            content.push(<svg height="2%" width="100%">
                <line x1="50%" y1="0" x2="50%" y2="50%" stroke="#6b6b6b" strokeWidth={2} />
            </svg>);
        }
        if (this.state.road.top_right) {
            content.push(<svg height="2%" width="100%">
                <line x1="100%" y1="0" x2="50%" y2="50%" stroke="#6b6b6b" strokeWidth={2} />
            </svg>);
        }
        if (this.state.road.right) {
            content.push(<svg height="2%" width="100%">
                <line x1="100%" y1="50%" x2="50%" y2="50%" stroke="#6b6b6b" strokeWidth={2} />
            </svg>);
        }
        if (this.state.road.bottom_right) {
            content.push(<svg height="2%" width="100%">
                <line x1="100%" y1="100%" x2="50%" y2="50%" stroke="#6b6b6b" strokeWidth={2} />
            </svg>);
        }
        if (this.state.road.bottom) {
            content.push(<svg height="2%" width="100%">
                <line x1="50%" y1="100%" x2="50%" y2="50%" stroke="#6b6b6b" strokeWidth={2} />
            </svg>);
        }
        if (this.state.road.bottom_left) {
            content.push(<svg height="2%" width="100%">
                <line x1="0" y1="100%" x2="50%" y2="50%" stroke="#6b6b6b" strokeWidth={2} />
            </svg>);
        }
        if (this.state.road.left) {
            content.push(<svg height="2%" width="100%">
                <line x1="0" y1="50%" x2="50%" y2="50%" stroke="#6b6b6b" strokeWidth={2} />
            </svg>);
        }

        return (content.length ? content : ' ');
    }

    className() {
        let className = '';

        if (this.state.hover) {
            className += 'hover ';
        }

        if (this.state.structure) {
            className += this.state.structure + ' ';
        }

        if (this.state.road.middle) {
            className += 'road ';
        }

        if (this.state.rampart) {
            className += 'rampart ';
        }

        if (this.state.source) {
            className += 'source ';
        }

        if (this.state.mineral) {
            className += this.state.mineral + ' ';
        }

        if (this.props.terrain & 1) {
            return className + 'cell wall';
        } else if (this.props.terrain & 2) {
            return className + 'cell swamp';
        } else {
            return className + 'cell plain';
        }
    }

    mouseEnter(e: any) {
        // update this.state.x and this.state.y
        this.setState({hover: true});
        this.props.parent.setState({
            x: parseInt(e.currentTarget.dataset.x),
            y: parseInt(e.currentTarget.dataset.y)
        });
        // handle click and drag
        if (e.buttons == 1) {
            this.onClick();
            this.setState({hover: false});
        } else if (e.buttons == 2) {
            this.onContextMenu(e);
            this.setState({hover: false});
        }
    }

    mouseLeave(e: any) {
        this.setState({hover: false});
    }

    onClick() {
        if (this.props.parent.addStructure(this.props.x, this.props.y)) {
            switch (this.props.parent.state.brush) {
                case('road'):
                    this.setState({road: true});
                    break;
                case('rampart'):
                    this.setState({rampart: true});
                    break;
                default:
                    this.setState({structure: this.props.parent.state.brush});
                    break;
            }
        }
    }

    onContextMenu(e: any) {
        e.preventDefault();

        if (this.state.structure !== '' || this.state.road || this.state.rampart) {
            this.props.parent.removeStructure(this.props.x, this.props.y, this.state.structure);
            this.props.parent.removeStructure(this.props.x, this.props.y, 'rampart');
            this.props.parent.removeStructure(this.props.x, this.props.y, 'road');
            
            this.setState({structure: '', road: false, rampart: false})
        }
    }

    render() {
        return (
            <div className={this.className()}
                onMouseEnter={this.mouseEnter.bind(this)}
                onMouseLeave={this.mouseLeave.bind(this)}
                onClick={this.onClick.bind(this)}
                onContextMenu={this.onContextMenu.bind(this)}
                data-x={this.props.x}
                data-y={this.props.y}>
                {this.getCellContent()}
            </div>
        );
    }
}

/**
 * Json Output Modal
 */

interface ModalJsonProps {
    planner: BuildingPlanner;
    modal: boolean;
}

class ModalJson extends React.Component<ModalJsonProps> {
    state: Readonly<{
        modal: boolean;
    }>;

    constructor(props: any) {
        super(props);
        this.state = {
            modal: false
        };
    }

    createJson() {
        let buildings: {[structure: string]: {pos: Array<{x: number, y: number}>}} = {};

        const parent = this.props.planner;
        let json = {
            name: parent.state.room,
            world: parent.state.world,
            shard: parent.state.shard,
            rcl: parent.state.rcl,
            buildings: buildings
        };
        const keepStructures = Object.keys(Constants.CONTROLLER_STRUCTURES);

        Object.keys(parent.state.structures).forEach((structure) => {
            if (keepStructures.indexOf(structure) > -1 && !json.buildings[structure]) {
                json.buildings[structure] = {
                    pos: parent.state.structures[structure]
                };
            }
        });

        return JSON.stringify(json);
    }

    import(e: any) {
        let json = JSON.parse(e.target.value);
        this.props.planner.loadJson(json);
    }

    shareableLink() {
        let string = LZString.compressToEncodedURIComponent(this.createJson());
        return "/building-planner/?share=" + string;
    }

    toggleModal() {
        this.setState({modal: !this.state.modal});
    }

    render() {
        return (
            <div>
                <button className="btn btn-secondary" onClick={() => this.toggleModal()} title="Share Results">
                    <FontAwesomeIcon icon={faShareAlt} />
                </button>
                <Modal isOpen={this.state.modal} toggle={() => this.toggleModal()} className="import-room">
                    <ModalHeader toggle={() => this.toggleModal()}>Share Results</ModalHeader>
                    <ModalBody>
                        <Input type="textarea" value={this.createJson()} id="json-data" onChange={(e) => this.import(e)} />
                        <a href={this.shareableLink()} id="share-link">Share Link</a>
                    </ModalBody>
                </Modal>
            </div>
        );
    }
}

/**
 * Import Room Form
 */

interface ModalImportRoomFormProps {
    planner: BuildingPlanner;
    room: string;
    world: string;
    shard: string;
    worlds: {[worldName: string]: {shards: string[]}};
    modal: boolean;
}

interface FieldValidation {
    value: string;
    validateOnChange: boolean;
    valid: boolean;
}

class ModalImportRoomForm extends React.Component<ModalImportRoomFormProps> {
    state: Readonly<{
        room: FieldValidation;
        world: FieldValidation;
        shard: FieldValidation;
        showStructures: boolean;
        submitCalled: boolean;
        modal: boolean;
    }>;

    constructor(props: any) {
        super(props);
        this.state = {
            room: {
                value: props.room,
                validateOnChange: false,
                valid: true
            },
            world: {
                value: props.world,
                validateOnChange: false,
                valid: true
            },
            shard: {
                value: props.shard,
                validateOnChange: false,
                valid: true
            },
            showStructures: true,
            submitCalled: false,
            modal: false
        };
        this.handleSubmit = this.handleSubmit.bind(this);
    }

    handleCheckboxChange(e: any) {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        this.setState({[e.target.name]: value});
        this.props.planner.setState({[e.target.name]: value});
    }

    handleTextBlur(e: any, validationFunc: Function) {
        const field: 'room' | 'world' | 'shard' = e.target.name;
        const value = e.target.value;

        if (this.state[field].validateOnChange === false &&
            this.state.submitCalled === false) {
            this.setState({
                [field]: {
                    value: value,
                    validateOnChange: true,
                    valid: validationFunc(value)
                }
            });
            this.props.planner.setState({[field]: value});
        }
    }

    handleTextChange(e: any, validationFunc: Function) {
        const field: 'room' | 'world' | 'shard' = e.target.name;
        const value = e.target.value;

        this.setState({
            [field]: {
                value: value,
                valid: (this.state[field].validateOnChange ? validationFunc(value) : true)
            }
        });
        this.props.planner.setState({[field]: value});

        if (field === 'world') {
            // Changing world select option will select the first shard drop-down option
            const firstOption = this.props.worlds[value].shards[0];
            this.setState({
                shard: {
                    value: firstOption,
                    valid: this.validateShard(value)
                }
            });
            this.props.planner.setState({shard: firstOption});
        }
    }

    validateRoom(room: string): boolean {
        if (typeof room !== 'string') return false;
        if (room.length < 4) return false;

        const regexRoom = new RegExp('^([WE]{1})([0-9]{1,2})([NS]{1})([0-9]{1,2})$');
        return room.match(regexRoom) !== null;
    }

    validateWorld(world: string): boolean {
        if (typeof world !== 'string') return false;
        if (world.length < 1) return false;

        return true;
    }

    validateShard(shard: string): boolean {
        if (typeof shard !== 'string') return false;
        if (shard.length < 1) return false;

        return true;
    }
    
    handleSubmit(e: any) {
        e.preventDefault();
        this.toggleModal();

        const parent = this.props.planner;
        const room = this.state.room.value;
        const world = this.state.world.value;
        const shard = this.state.shard.value;
        const includeStructs = this.state.showStructures;

        const validation = [
            {
                field: 'room',
                value: room,
                validationFunc: this.validateRoom
            },
            {
                field: 'world',
                value: world,
                validationFunc: this.validateWorld
            },
            {
                field: 'shard',
                value: shard,
                validationFunc: this.validateShard
            }
        ];

        for (let props of validation) {
            let valid = props.validationFunc(props.value);
            this.setState({
                [props.field]: {
                    value: props.value,
                    valid: valid,
                    validateOnChange: !valid
                }
            });
            if (!valid) {
                return;
            }
        }

        fetch(`/api/terrain/${world}/${shard}/${room}`).then((response) => {
            response.json().then((data: any) => {
                let terrain = data.terrain[0].terrain;
                let terrainMap: TerrainMap = {};
                for (var y = 0; y < 50; y++) {
                    terrainMap[y] = {};
                    for (var x = 0; x < 50; x++) {
                        let code = terrain.charAt(y * 50 + x);
                        terrainMap[y][x] = code;
                    }
                }
                parent.setState({
                    terrain: terrainMap,
                    room: room, 
                    world: world, 
                    shard: shard
                });
            });
        });

        fetch(`/api/objects/${world}/${shard}/${room}`).then((response) => {
            response.json().then((data: any) => {
                let sources: {x: number, y: number}[] = [];
                let mineral: {[mineralType: string]: {x: number, y: number}} = {};
                let structures: {[structure: string]: {x: number, y: number}[]} = {};

                let keepStructures = ['controller'];
                if (includeStructs) {
                    keepStructures.push(...Object.keys(Constants.CONTROLLER_STRUCTURES));
                }
                for (let o of data.objects) {
                    if (o.type == 'source') {
                        sources.push({
                            x: o.x,
                            y: o.y
                        });
                    } else if (o.type == 'mineral') {
                        mineral[o.mineralType] = {
                            x: o.x,
                            y: o.y
                        };
                    } else {
                        if (keepStructures.indexOf(o.type) > -1) {
                            if (!structures[o.type]) {
                                structures[o.type] = [];
                            }
                            structures[o.type].push({
                                x: o.x,
                                y: o.y
                            });
                        }
                    }
                }
                parent.setState({
                    structures: structures,
                    sources: sources,
                    mineral: mineral
                });
            });
        });
    }

    toggleModal() {
        this.setState({modal: !this.state.modal});
    }
    
    render() {
        return (
            <div>
                <button className="btn btn-secondary" onClick={() => this.toggleModal()} title="Import Room">
                    <FontAwesomeIcon icon={faCloudUploadAlt} />
                </button>
                <Modal isOpen={this.state.modal} toggle={() => this.toggleModal()} className="import-room">
                    <ModalHeader toggle={() => this.toggleModal()}>Import Room</ModalHeader>
                    <ModalBody>
                        <form id="load-room" className="load-room" onSubmit={this.handleSubmit}>
                            <Row>
                                <Col xs={6}>
                                    <Label for="worldName">World</Label>
                                    {Object.keys(this.props.worlds).length === 0 &&
                                        <div className="loading">Loading</div>
                                    }
                                    {Object.keys(this.props.worlds).length > 0 &&
                                        <Input type="select" id="worldName" name="world" invalid={!this.state.world.valid} onChange={(e) => this.handleTextChange(e, this.validateWorld)}>
                                            {Object.keys(this.props.worlds).map((world: string) => {
                                                return <option key={world} value={world}>{screepsWorlds[world]}</option>
                                            })}
                                        </Input>
                                    }
                                    <FormFeedback>Invalid world selection</FormFeedback>
                                </Col>
                                <Col xs={6}>
                                    <Label for="shardName">Shard</Label>
                                    {!this.state.world.valid &&
                                        <div className="loading">Loading</div>
                                    }
                                    {this.state.world.valid &&
                                        <Input type="select" id="shardName" name="shard" invalid={!this.state.shard.valid} onChange={(e) => this.handleTextChange(e, this.validateShard)}>
                                            {this.props.worlds[this.state.world.value] && this.props.worlds[this.state.world.value].shards.map((shard) => {
                                                return <option key={shard} value={shard}>{shard}</option>
                                            })}
                                        </Input>
                                    }
                                    <FormFeedback>Invalid shard selection</FormFeedback>
                                </Col>
                            </Row>
                            <Row>
                                <Col xs={6}>
                                    <Label for="roomName">Room</Label>
                                    <Input type="text" id="roomName" name="room" value={this.state.room.value} invalid={!this.state.room.valid} onBlur={(e) => this.handleTextBlur(e, this.validateRoom)} onChange={(e) => this.handleTextChange(e, this.validateRoom)} />
                                    <FormFeedback>Invalid room name</FormFeedback>
                                </Col>
                                <Col xs={6}>
                                    <Label className="show-structures">
                                        <Input type="checkbox" name="showStructures" checked={this.state.showStructures} onChange={(e) => this.handleCheckboxChange(e)} />
                                        Include Structures
                                    </Label>
                                </Col>
                            </Row>
                            <Row>
                                <Col>
                                    
                                </Col>
                            </Row>
                        </form>
                    </ModalBody>
                    <ModalFooter>
                        <button type="submit" form="load-room" className="btn btn-primary" onMouseDown={() => this.setState({submitCalled: true})}>
                            Import Room
                        </button>
                    </ModalFooter>
                </Modal>
            </div>
        );
    }
}
