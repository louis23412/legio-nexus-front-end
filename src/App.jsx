import './App.css';
import { io } from 'socket.io-client';
import React from 'react';

import mainLogo from './logo.png';

const uniqueId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

class App extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            isReady: false,
            connection: false,

            modelIsWorking : false,

            userPrompt : '',
            conversationId : '',
            userAlias : 'default-user',

            modelLockHolder : '',

            agentEvents: {}
        };

        this.socket = null;
        this.socketAddress = `${import.meta.env.localIp}:3005/chat`;
    }

    componentDidMount() {
        const userAlias = this.getAlias();
        if (userAlias) this.setState({ userAlias });

        const conversationId = this.getConversationId();
        if (conversationId) this.setState({ conversationId });

        const isReady = this.getReadyState();
        if (isReady) this.setState({ isReady });

        const userPrompt = this.getUserPrompt();
        if (userPrompt) this.setState({ userPrompt });

        const agentEvents = this.getAgentEvents();
        if (agentEvents) this.setState({ agentEvents });

        this.socket = io(this.socketAddress);

        this.socket.on('connect', () => { this.setState({ connection : true }) });
        this.socket.on('disconnect', () => { this.setState({ connection : false}) });

        this.socket.emit('get-worker-state');

        this.socket.onAny((eventName, data) => {
            if (eventName === 'worker-state') {
                this.setState({ modelIsWorking : data.isWorking, modelLockHolder : data.conversationId === null ? '' : data.conversationId })
            }

            const eventId = data?.eventId;
            if (!eventId) return;

            const newLine =  typeof data.data === 'string' ? data.data : JSON.stringify(data.data);

            this.setState(prevState => {
                const currentText = prevState.agentEvents[eventId] || '';
                return {
                    agentEvents: {
                        ...prevState.agentEvents,
                        [eventId]: `${currentText}${newLine}`
                    }
                };
            });

            this.setAgentEvents(this.state.agentEvents);
        });
    }

    componentWillUnmount() {
        if (this.socket) this.socket.disconnect();
    }

    componentDidUpdate() {
        console.log(this.state)
    }

    setAlias(a) {
        window.localStorage.setItem('legio-nexus-alias', JSON.stringify(a));
    }

    getAlias() {
        return JSON.parse(window.localStorage.getItem('legio-nexus-alias'));
    }

    setConversationId(id) {
        window.localStorage.setItem('legio-nexus-conversation-id', JSON.stringify(id));
    }

    getConversationId() {
        return JSON.parse(window.localStorage.getItem('legio-nexus-conversation-id'));
    }

    setReadyState(bool) {
        window.localStorage.setItem('legio-nexus-ready-state', JSON.stringify(bool));
    }

    getReadyState() {
        return JSON.parse(window.localStorage.getItem('legio-nexus-ready-state'));
    }

    setUserPrompt(p) {
        window.localStorage.setItem('legio-nexus-user-prompt', JSON.stringify(p));
    }

    getUserPrompt() {
        return JSON.parse(window.localStorage.getItem('legio-nexus-user-prompt'));
    }

    setAgentEvents(e) {
        window.localStorage.setItem('legio-nexus-agent-events', JSON.stringify(e));
    }

    getAgentEvents() {
        return JSON.parse(window.localStorage.getItem('legio-nexus-agent-events'));
    }

    render() {
        if (!this.state.isReady) {
            return (
                <div>
                    <div className={'server-status'}>
                        <p className={`${this.state.modelIsWorking ? 'model-working' : 'model-idle'}`}>𖡎 {this.state.modelIsWorking? 'working' : 'idle'}</p>
                        <p className={`${this.state.connection ? 'server-connected' : 'server-disconnected'}`}>⇄ {this.state.connection ? 'connected' : 'disconnected'}</p>
                    </div>

                    <div className='input-view'>
                        <img src={mainLogo} alt="main logo" />

                        <textarea
                            onChange={(i) => { 
                                this.setState({ userAlias : i.target.value });
                                this.setAlias(i.target.value);
                            }}
                            className='user-input size-20'
                            placeholder={this.state.userAlias}
                        />

                        <textarea
                            onChange={(i) => {
                                this.setState({ userPrompt : i.target.value });
                                this.setUserPrompt(i.target.value);
                            }}
                            className='user-input size-50'
                            id = 'user-prompt'
                            placeholder="What would you like to know?"
                            value={this.state.userPrompt}
                        />

                        <div>
                            <button
                                className='user-button'

                                onClick={() => {
                                    let newId = this.state.conversationId;

                                    if (this.state.conversationId.length === 0) {
                                        newId = uniqueId();
                                        this.setConversationId(newId)
                                    }

                                    this.setReadyState(true);
                                
                                    this.setState({
                                        isReady: true,
                                        conversationId: newId
                                    })
                                }}

                                disabled={this.state.userPrompt.length < 5 ? true : false}
                            >
                                ▷ Start Agents
                            </button>

                            <button
                                className='user-button'
                                onClick={() => { 
                                    this.setState({ userPrompt: '' });
                                    this.setUserPrompt('');
                                    document.getElementById('user-prompt').value = '';
                                }}
                            >
                                ↻ Clear Prompt
                            </button>
                        </div>
                    </div>
                </div>

            )
        }
        
        else {
            return (
                <div className='ready-view'>
                    <div className='ready-header'>
                        <button 
                            className='user-button'
                            onClick={() => {
                                this.setConversationId('');
                                this.setUserPrompt('');
                                this.setReadyState(false);
                                this.setAgentEvents({});

                                this.setState({ 
                                    conversationId : '',
                                    userPrompt : '',
                                    isReady : false,
                                    agentEvents : {}
                                })

                                if (this.state.modelIsWorking && this.state.modelLockHolder === this.state.conversationId) {
                                    this.socket.emit('stop-conversation', {
                                        conversationId: this.state.conversationId
                                    }) 
                                }
                            }}
                        >
                            ← Go Back
                        </button>

                        <div className={'server-status'}>
                            <p className={`${this.state.modelIsWorking ? 'model-working' : 'model-idle'}`}>𖡎 {this.state.modelIsWorking? 'working' : 'idle'}</p>
                            <p className={`${this.state.connection ? 'server-connected' : 'server-disconnected'}`}>⇄ {this.state.connection ? 'connected' : 'disconnected'}</p>
                        </div>

                    </div>

                    <div className='ready-info-bar'>
                        <p>Conversation id: <span className='theme-text'>{this.state.conversationId}</span></p>
                        <p>User alias: <span className='theme-text'>{this.state.userAlias}</span></p>
                    </div>

                    <div>
                        <div className='event-stream-box'>
                            {Object.keys(this.state.agentEvents).length === 0 && (
                                <p>Waiting for events...</p>
                            )}

                            {Object.entries(this.state.agentEvents).map(([eventId, content]) => (
                                <div key={eventId}>
                                    <strong>Event ID: {eventId}</strong>
                                    <div>{content}</div>
                                </div>
                            ))}
                        </div>

                        <button
                            className='user-button event-clear'
                            onClick={() => {
                                this.setAgentEvents({});
                                this.setState({ agentEvents : {} })
                            }}
                        >
                            ↻ Clear Events
                        </button>
                    </div>

                    <div className='sticky-bottom'>
                        <textarea
                            onChange={(i) => {
                                this.setUserPrompt(i.target.value);
                                this.setState({ userPrompt : i.target.value })
                            }}
                            className='user-input size-50'
                            id = 'user-prompt2'
                            placeholder="What would you like to know?"
                            value={this.state.userPrompt}
                        />

                        <button
                            className='user-button'
                            onClick={
                                () => {
                                    if (this.state.modelIsWorking && this.state.modelLockHolder === this.state.conversationId) {
                                        this.socket.emit('stop-conversation', {
                                            conversationId: this.state.conversationId,
                                        });
                                    }

                                    else {
                                        this.socket.emit('start-conversation', {
                                            alias : this.state.userAlias,
                                            prompt : this.state.userPrompt, 
                                            conversationId: this.state.conversationId,
                                        });
                                    }
                                }
                            }

                            disabled={this.state.userPrompt.length < 5 ? true : false}
                        >
                            {this.state.modelIsWorking && this.state.modelLockHolder === this.state.conversationId ? '◻ Stop' : '▷ Start'}
                        </button>

                        <button
                            className='user-button'
                            onClick={() => {
                                this.setUserPrompt('');
                                this.setState({ userPrompt: '' });
                                document.getElementById('user-prompt2').value = '';
                            }}
                        >
                            ↻ Clear Prompt
                        </button>
                    </div>
                </div>
            );
        }
    }
}

export default App;