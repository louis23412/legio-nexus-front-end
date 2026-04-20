import './App.css';
import { io } from 'socket.io-client';
import React from 'react';
import Markdown from 'react-markdown';

import mainLogo from './logo.png';

const uniqueId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

const stringifyEventData = (data) => {
    try {
        return JSON.stringify(data, null, 4);
    } catch (error) {
        return data;
    }
}

const parseEventData = (data) => {
    try {
        return JSON.parse(data);
    } catch (error) {
        return data;
    }
} 

class App extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            isReady: false,
            connection: false,

            modelIsWorking : false,
            modelIsStopping : false,

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
        this.scrollToBottom();

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
                this.setState({
                    modelIsWorking: data.isWorking,
                    modelIsStopping: data.isStopping,
                    modelLockHolder: data.conversationId === null ? '' : data.conversationId
                });

                return;
            }

            const eventId = data?.eventId;
            if (!eventId) return;

            if (eventName === 'user-prompt') {
                this.setState(prevState => {
                    const newEvents = {
                        ...prevState.agentEvents,
                        [eventId]: {
                            eventType: eventName,
                            user_alias: data.data.user_alias,
                            data: data.data.user_prompt
                        }
                    };

                    this.setAgentEvents(newEvents);

                    return { agentEvents: newEvents };
                });
            }

            if (eventName === 'call-tool') {
                this.setState(prevState => {
                    const newEvents = {
                        ...prevState.agentEvents,
                        [eventId]: {
                            caller: data.data.caller,
                            eventType: eventName,
                            tool_name: data.data.tool_name,
                            arguments: data.data.arguments
                        }
                    };

                    this.setAgentEvents(newEvents);

                    return { agentEvents: newEvents };
                });
            }

            if (eventName === 'tool-result') {
                this.setState(prevState => {
                    const newEvents = {
                        ...prevState.agentEvents,
                        [eventId]: {
                            caller: data.data.caller,
                            eventType: eventName,
                            tool_name: data.data.tool_name,
                            result: data.data.result
                        }
                    };

                    this.setAgentEvents(newEvents);

                    return { agentEvents: newEvents };
                });
            }

            if (eventName === 'ollama-calls-fail') {
                this.setState(prevState => {
                    const newEvents = {
                        ...prevState.agentEvents,
                        [eventId]: {
                            eventType: eventName,
                            total_tries : data.data.retries,
                            error_message : data.data.error
                        }
                    }

                    this.setAgentEvents(newEvents);

                    return { agentEvents : newEvents }
                })
            }

            if (eventName === 'ollama-call-retry') {
                this.setState(prevState => {
                    const newEvents = {
                        ...prevState.agentEvents,
                        [eventId]: {
                            eventType: eventName,
                            current_try : data.data.current_try,
                            max_tries : data.data.max_tries
                        }
                    }

                    this.setAgentEvents(newEvents);

                    return { agentEvents : newEvents }
                })
            }

            if (eventName === 'no-tool-handler') {
                this.setState(prevState => {
                    const newEvents = {
                        ...prevState.agentEvents,
                        [eventId]: {
                            eventType: eventName,
                            caller : data.data.caller,
                            failed_name : data.data.failed_name
                        }
                    }

                    this.setAgentEvents(newEvents);

                    return { agentEvents : newEvents }
                })
            }

            if (eventName === 'think' || eventName === 'content') {
                this.setState(prevState => {
                    const currentText = prevState.agentEvents[eventId]?.data || '';

                    const newEvents = {
                        ...prevState.agentEvents,
                        [eventId]: {
                            agent: data.agentName,
                            eventType: eventName,
                            data: `${currentText}${data.data}`
                        }
                    };

                    this.setAgentEvents(newEvents);

                    return { agentEvents: newEvents };
                });
            }

            if (eventName === 'final-answer') {
                this.setState(prevState => {
                    const newEvents = {
                        ...prevState.agentEvents,
                        [eventId] : {
                            final_answer : data.data.final_answer,
                            eventType : eventName,
                            runtime : data.data.runtime
                        }
                    }

                    this.setAgentEvents(newEvents);

                    return { agentEvents : newEvents };
                })
            }

            if (eventName === 'sanity-check-1' || eventName === 'sanity-check-2' || eventName === 'sanity-verify') {
                this.setState(prevState => {
                    const currentText = prevState.agentEvents[eventId]?.data || '';

                    const newEvents = {
                        ...prevState.agentEvents,
                        [eventId]: {
                            agent: data.data.agent,
                            eventType: eventName,
                            data: `${currentText}${data.data.content}`
                        }
                    };

                    this.setAgentEvents(newEvents);

                    return { agentEvents: newEvents };
                });
            }

            if (eventName === 'sanity-gate') {
                this.setState(prevState => {
                    const newEvents = {
                        ...prevState.agentEvents,
                        [eventId]: {
                            agent: data.data.agent,
                            eventType: eventName,
                            values : {
                                semantic_similarity : data.data.semantic_similarity,
                                keyword_similarity : data.data.keyword_similarity,
                                reliability_score : data.data.reliability_score
                            }
                        }
                    };

                    this.setAgentEvents(newEvents);

                    return { agentEvents: newEvents };
                });
            }

            if (eventName === 'anchor-create') {
                this.setState(prevState => {
                    const newEvents = {
                        ...prevState.agentEvents,
                        [eventId]: {
                            agent: data.data.agent,
                            eventType: eventName,
                            data: data.data.content
                        }
                    };

                    this.setAgentEvents(newEvents);

                    return { agentEvents: newEvents };
                });
            }

            if (eventName === 'anchor-skip') {
                this.setState(prevState => {
                    const newEvents = {
                        ...prevState.agentEvents,
                        [eventId]: {
                            agent: data.data,
                            eventType: eventName
                        }
                    };

                    this.setAgentEvents(newEvents);

                    return { agentEvents: newEvents };
                });
            }
        });
    }

    componentWillUnmount() {
        if (this.socket) this.socket.disconnect();
    }

    componentDidUpdate() {
        this.scrollToBottom();
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

    setAgentEvents (e) {
        window.localStorage.setItem('legio-nexus-agent-events', JSON.stringify(e));
    }

    getAgentEvents() {
        return JSON.parse(window.localStorage.getItem('legio-nexus-agent-events'));
    }

    scrollToBottom() {
        if (this.messagesEnd) this.messagesEnd.scrollIntoView({ behavior: 'smooth' });
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

                            <div>
                                {
                                    Object.entries(this.state.agentEvents).map(([eventId, content]) => {
                                        if (content.eventType === 'user-prompt') {
                                            return(
                                                <div key={eventId} className='user-prompt-div'>
                                                    <div className='underline bolder'>{`👤 @${content.user_alias}`}</div>
                                                    <p>{content.data}</p>
                                                </div>
                                            )
                                        }

                                        if (content.eventType === 'think') {
                                            return(
                                                <div key={eventId} className='think-div'>
                                                    <div className='underline bolder'>{`🧠 @${content.agent} - think`}</div>
                                                    <Markdown>{content.data}</Markdown>
                                                </div>
                                            )
                                        }

                                        if (content.eventType === 'content') {
                                            return(
                                                <div key={eventId} className='speak-div'>
                                                    <div className='underline bolder'>{`🤖 @${content.agent} - speak`}</div>
                                                    <Markdown>{content.data}</Markdown>
                                                </div>
                                            )
                                        }

                                        if (content.eventType === 'final-answer') {
                                            return(
                                                <div key={eventId} className='speak-div'>
                                                    <div className='underline bolder'>Final Answer:</div>
                                                    <Markdown>{content.final_answer}</Markdown>
                                                    <strong><br />Runtime: {content.runtime} seconds</strong>
                                                </div>
                                            )
                                        }

                                        if (content.eventType === 'call-tool') {
                                            return(
                                                <div key={eventId} className='tool-call-div'>
                                                    <details>
                                                        <summary className='black-text'>{`⚙️ @${content.caller} use tool → ${content.tool_name}`}</summary>
                                                        <pre className='black-background'>{ stringifyEventData(content.arguments) }</pre>
                                                    </details>
                                                </div>
                                            )
                                        }
                                        
                                        if (content.eventType === 'tool-result') {
                                            return(
                                                <div key={eventId} className='tool-call-div'>
                                                    <details>
                                                        <summary className='black-text'>{`⚙️ Tool result for ${content.tool_name} used by → @${content.caller}`}</summary>
                                                        <pre className='black-background'>{ stringifyEventData(content.result) }</pre>
                                                    </details>
                                                </div>
                                            )
                                        }

                                        if (content.eventType === 'sanity-check-1') {
                                            return(
                                                <div key={eventId} className='sanity-div'>
                                                    <details>
                                                        <summary>{`🗒️ @${content.agent} sanity check #1`}</summary>
                                                        <pre className='black-background'>{content.data}</pre>
                                                    </details>
                                                    
                                                </div>
                                            )
                                        }

                                        if (content.eventType === 'sanity-check-2') {
                                            return(
                                                <div key={eventId} className='sanity-div'>
                                                    <details>
                                                        <summary>{`🗒️ @${content.agent} sanity check #2`}</summary>
                                                        <pre className='black-background'>{content.data}</pre>
                                                    </details>
                                                    
                                                </div>
                                            )
                                        }

                                        if (content.eventType === 'sanity-verify') {
                                            return(
                                                <div key={eventId} className='sanity-div'>
                                                    <details>
                                                        <summary>{`🗒️ @${content.agent} sanity verification`}</summary>
                                                        <pre className='black-background'>{ stringifyEventData(parseEventData(content.data)) }</pre>
                                                    </details>
                                                </div>
                                            )
                                        }

                                        if (content.eventType === 'sanity-gate') {
                                            console.log(content)
                                            return(
                                                <div key={eventId} className='sanity-div'>
                                                    <details>
                                                        <summary>{`🗒️ @${content.agent} sanity gate`}</summary>
                                                        <pre className='black-background'>{ stringifyEventData(content.values) }</pre>
                                                    </details>
                                                </div>
                                            )
                                        }

                                        if (content.eventType === 'anchor-create') {
                                            return(
                                                <div key={eventId} className='anchor-div'>
                                                    <details>
                                                        <summary>{`🚩 New context anchor created for @${content.agent}`}</summary>
                                                        <pre className='black-background'>{content.data}</pre>
                                                    </details>
                                                </div>
                                            )
                                        }

                                        if (content.eventType === 'anchor-skip') {
                                            return(
                                                <div key={eventId} className='anchor-div'>
                                                    {`🔴 Context anchor creation skipped for @${content.agent}`}
                                                </div>
                                            )
                                        }

                                        if (content.eventType === 'ollama-calls-fail') {
                                            return(
                                                <div key={eventId} className='error-div'>
                                                    {`⚠️ System critical fail. Total retries: ${content.total_tries}. Error: ${content.error_message}`}
                                                </div>
                                            )
                                        }

                                        if (content.eventType === 'ollama-call-retry') {
                                            return(
                                                <div key={eventId} className='error-div'>
                                                    {`⚠️ System chat call fail. Retrying... ${content.current_try} / ${content.max_tries}`}
                                                </div>
                                            )
                                        }

                                        if (content.eventType === 'no-tool-handler') {
                                            return(
                                                <div key={eventId} className='error-div'>
                                                    {`⚠️ @${content.caller} tried to use a tool with no handler. Tool name used: "${content.failed_name}"`}
                                                </div>
                                            )
                                        }
                                    })
                                }

                                <div ref={(el) => (this.messagesEnd = el)} />
                            </div>
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

                            disabled={
                                this.state.userPrompt.length < 5 ? true : false
                            }
                        >
                            {
                                this.state.modelIsWorking && this.state.modelLockHolder === this.state.conversationId 
                                    ? this.state.modelIsStopping ? 'Stopping...' : '◻ Stop'
                                    : '▷ Start'
                            }
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