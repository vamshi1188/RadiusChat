import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { User, Message, ChatState, ChatSession, SocketMessage } from './types';
import { websocketBackend } from './services/websocketBackend';
import { MapMarkers } from './components/MapMarkers';
import { NeonCard, NeonButton, NeonInput, Badge } from './components/UIComponents';

const App: React.FC = () => {
  // State
  const [hasLocation, setHasLocation] = useState(false);
  const [initialPos, setInitialPos] = useState<[number, number]>([51.505, -0.09]);
  const [users, setUsers] = useState<User[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [myName, setMyName] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // Chat State
  const [chatState, setChatState] = useState<ChatState>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [session, setSession] = useState<ChatSession | null>(null);
  const [pendingTarget, setPendingTarget] = useState<User | null>(null);
  const [incomingRequest, setIncomingRequest] = useState<{fromId: string, fromName: string} | null>(null);

  // Refs
  const msgsEndRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  // 1. Geolocation on Mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setInitialPos([position.coords.latitude, position.coords.longitude]);
          setHasLocation(true);
        },
        (error) => {
          console.error("Geo Error", error);
          // Fallback to default, but allow app to run
          setHasLocation(true); 
        }
      );
    } else {
      setHasLocation(true);
    }
  }, []);

  // 2. WebSocket Listeners
  useEffect(() => {
    websocketBackend.onMessage((msg: SocketMessage) => {
      switch (msg.type) {
        case 'login_success':
          setMyId(msg.payload.id);
          break;
        case 'world_state':
          setUsers(msg.payload.users);
          break;
        case 'chat_request':
          setIncomingRequest(msg.payload); // { fromId, fromName }
          break;
        case 'chat_connected':
          setChatState('chatting');
          setSession(msg.payload);
          setIncomingRequest(null);
          setPendingTarget(null);
          addSystemMessage(`Encrypted channel established with ${msg.payload.partnerName}`);
          break;
        case 'chat_msg':
          addMessage(msg.payload.content, msg.payload.fromId === myId ? 'me' : 'partner', msg.payload.fromId);
          break;
        case 'chat_ended':
          setChatState('idle');
          setSession(null);
          addSystemMessage('Connection terminated.');
          break;
      }
    });

    return () => {
      websocketBackend.disconnect();
    };
  }, [myId]); // Re-bind if myId changes (though listeners are array based in mock)

  // 3. Keep updating location if logged in (Simulation)
  useEffect(() => {
    if (!isLoggedIn || !myId) return;
    const interval = setInterval(() => {
        // Just jitter location slightly for realism in demo
        // In real app, this would use watchPosition
        websocketBackend.send({
            type: 'update_location',
            payload: { lat: initialPos[0], lon: initialPos[1] }
        });
    }, 5000);
    return () => clearInterval(interval);
  }, [isLoggedIn, myId, initialPos]);

  // 4. Auto scroll chat
  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  // --- Handlers ---

  const handleLogin = () => {
    if (!myName.trim()) return;
    const id = websocketBackend.connect(myName, initialPos[0], initialPos[1]);
    setMyId(id);
    setIsLoggedIn(true);
  };

  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    websocketBackend.send({ type: 'chat_msg', payload: { content: inputText } });
    addMessage(inputText, 'me', myId || 'me');
    setInputText('');
  };

  const handleUserClick = (user: User) => {
    if (chatState !== 'idle') return;
    setPendingTarget(user);
  };

  const confirmConnect = () => {
    if (!pendingTarget) return;
    setChatState('waiting');
    websocketBackend.send({ type: 'request_chat', payload: { targetId: pendingTarget.id } });
  };

  const cancelConnect = () => {
    if (!pendingTarget) return;
    setPendingTarget(null);
    setChatState('idle');
    websocketBackend.send({ type: 'cancel_request', payload: { targetId: pendingTarget.id } });
  };

  const acceptRequest = () => {
    if (!incomingRequest) return;
    websocketBackend.send({ type: 'accept_chat', payload: { requesterId: incomingRequest.fromId } });
    // Optimistic update
    setChatState('chatting');
    setSession({ partnerId: incomingRequest.fromId, partnerName: incomingRequest.fromName });
    setIncomingRequest(null);
  };

  const declineRequest = () => {
    if (!incomingRequest) return;
    websocketBackend.send({ type: 'decline_chat', payload: { requesterId: incomingRequest.fromId } });
    setIncomingRequest(null);
  };

  const endChat = () => {
    websocketBackend.send({ type: 'end_chat' });
    setChatState('idle');
    setSession(null);
  };

  // Helper
  const addMessage = (text: string, source: 'me' | 'partner' | 'system', senderId?: string) => {
    setMessages(prev => [...prev, {
      id: Math.random().toString(36),
      text,
      type: source === 'system' ? 'system' : 'text',
      senderId: senderId || 'sys',
      senderName: source === 'me' ? 'You' : session?.partnerName || 'Unknown',
      timestamp: Date.now()
    }]);
  };
  
  const addSystemMessage = (text: string) => addMessage(text, 'system');

  // --- Render ---

  return (
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden flex flex-col md:flex-row">
      
      {/* 1. Map Layer (Background) */}
      <div className="absolute inset-0 z-0">
        {hasLocation && (
          <MapContainer 
            center={initialPos} 
            zoom={14} 
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            {/* Dark Theme Tiles */}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <MapMarkers 
              users={users} 
              myId={myId} 
              partnerId={session?.partnerId || null}
              onUserClick={handleUserClick} 
            />
          </MapContainer>
        )}
      </div>

      {/* 2. UI Overlay - Sidebar */}
      <div className="relative z-10 w-full md:w-96 h-[40vh] md:h-full bg-slate-900/80 backdrop-blur-md border-r border-slate-700 flex flex-col shadow-2xl transition-all duration-300 pointer-events-auto order-2 md:order-1">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-700 bg-slate-900/50">
          <div className="flex items-center space-x-3">
             <div className="w-8 h-8 rounded bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.6)] flex items-center justify-center">
               <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
             </div>
             <div>
               <h1 className="text-xl font-bold text-white tracking-widest uppercase font-mono">RadiusChat</h1>
               <div className="text-xs text-cyan-400">Proximity Network Active</div>
             </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col">
          
          {!isLoggedIn ? (
            <div className="my-auto space-y-6 animate-fadeIn">
              <div className="text-slate-300 text-sm leading-relaxed">
                Connect to the Radius network. Visualize nearby users and establish secure communication channels with peers in your sector.
              </div>
              <div className="space-y-4">
                <NeonInput 
                  placeholder="ENTER ID / NAME" 
                  value={myName} 
                  onChange={(e: any) => setMyName(e.target.value)}
                />
                <NeonButton onClick={handleLogin} className="w-full">
                  Connect to Network
                </NeonButton>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
               {/* Status Bar */}
               <div className="flex justify-between items-center mb-4 bg-slate-800/50 p-2 rounded border border-slate-700">
                 <div className="flex flex-col">
                   <span className="text-xs text-slate-400">IDENTITY</span>
                   <span className="font-bold text-cyan-300">{myName}</span>
                 </div>
                 <div className="flex flex-col items-end">
                   <span className="text-xs text-slate-400">STATUS</span>
                   <Badge status={chatState} />
                 </div>
               </div>

               {chatState === 'idle' && (
                 <div className="flex-1 flex items-center justify-center text-center p-4 border border-dashed border-slate-700 rounded-lg">
                   <div className="text-slate-500 text-sm">
                     <p className="mb-2">Scanning sector...</p>
                     <p className="text-xs opacity-70">Select a target on the map to initiate Radius handshake.</p>
                   </div>
                 </div>
               )}

               {chatState === 'waiting' && pendingTarget && (
                 <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4 animate-pulse">
                   <div className="w-16 h-16 rounded-full border-4 border-amber-500 flex items-center justify-center">
                     <div className="w-3 h-3 bg-amber-500 rounded-full animate-ping"></div>
                   </div>
                   <h3 className="text-amber-400 font-bold text-lg">Awaiting Handshake</h3>
                   <p className="text-slate-400">Target: {pendingTarget.name}</p>
                   <NeonButton variant="secondary" onClick={cancelConnect}>Abort Sequence</NeonButton>
                 </div>
               )}

               {chatState === 'chatting' && (
                 <div className="flex-1 flex flex-col min-h-0 bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                   {/* Messages */}
                   <div className="flex-1 overflow-y-auto p-4 space-y-3">
                     {messages.map((msg) => (
                       msg.type === 'system' ? (
                         <div key={msg.id} className="text-center text-[10px] text-slate-500 uppercase tracking-widest my-2">- {msg.text} -</div>
                       ) : (
                         <div key={msg.id} className={`flex flex-col ${msg.senderName === 'You' ? 'items-end' : 'items-start'}`}>
                           <div className={`max-w-[85%] rounded-lg p-3 text-sm ${
                             msg.senderName === 'You' 
                               ? 'bg-cyan-900/50 text-cyan-100 border border-cyan-800 rounded-br-none' 
                               : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
                           }`}>
                             {msg.text}
                           </div>
                           <span className="text-[10px] text-slate-600 mt-1">{msg.senderName}</span>
                         </div>
                       )
                     ))}
                     <div ref={msgsEndRef} />
                   </div>
                   
                   {/* Chat Input */}
                   <div className="p-3 bg-slate-900 border-t border-slate-700">
                     <div className="flex space-x-2">
                       <input 
                         className="flex-1 bg-slate-800 text-white text-sm rounded px-3 py-2 outline-none focus:ring-1 focus:ring-cyan-500"
                         placeholder="Transmit message..."
                         value={inputText}
                         onChange={(e) => setInputText(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                       />
                       <button onClick={handleSendMessage} className="bg-cyan-600 text-white rounded px-3 hover:bg-cyan-500 transition-colors">
                         ➤
                       </button>
                     </div>
                     <button onClick={endChat} className="w-full mt-2 text-xs text-red-400 hover:text-red-300">Terminate Connection</button>
                   </div>
                 </div>
               )}
            </div>
          )}
        </div>
      </div>

      {/* 3. Global Overlays / Modals */}
      
      {/* Connect Confirmation Modal */}
      {pendingTarget && chatState === 'idle' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <NeonCard className="max-w-sm w-full text-center">
            <h3 className="text-xl font-bold text-white mb-2">Target Acquired</h3>
            <p className="text-slate-400 mb-6">Initiate connection sequence with <span className="text-cyan-400 font-bold">{pendingTarget.name}</span>?</p>
            <div className="flex space-x-3 justify-center">
              <NeonButton variant="secondary" onClick={() => setPendingTarget(null)}>Cancel</NeonButton>
              <NeonButton onClick={confirmConnect}>Connect</NeonButton>
            </div>
          </NeonCard>
        </div>
      )}

      {/* Incoming Request Modal */}
      {incomingRequest && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-bounce-slight">
          <NeonCard className="max-w-sm w-full text-center border-pink-500 shadow-pink-900/50">
            <div className="w-12 h-12 mx-auto bg-pink-500 rounded-full flex items-center justify-center mb-4 animate-pulse">
               <span className="text-2xl">!</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-1">Incoming Transmission</h3>
            <p className="text-slate-400 mb-6"><span className="text-pink-400 font-bold">{incomingRequest.fromName}</span> is requesting a secure channel.</p>
            <div className="flex space-x-3 justify-center">
              <NeonButton variant="danger" onClick={declineRequest}>Decline</NeonButton>
              <NeonButton variant="primary" className="bg-pink-600 border-pink-400 hover:bg-pink-500" onClick={acceptRequest}>Accept</NeonButton>
            </div>
          </NeonCard>
        </div>
      )}

      {/* Mobile Map Click Hint (if sidebar covers map) */}
      <div className="absolute top-4 right-4 z-0 md:hidden pointer-events-none">
         {/* Just placeholder for layout balance */}
      </div>

    </div>
  );
};

export default App;