// State
let myID = null;
let myName = null;
let myLat = 0;
let myLon = 0;
let ws = null;
let markers = {}; // id -> L.marker
let connectionLine = null;
let isChatting = false;
let partnerID = null;
let localMarker = null; // Marker for self before login

// DOM Elements
const mapElement = document.getElementById('map');
const loginSection = document.getElementById('login-section');
const chatSection = document.getElementById('chat-section');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');
const requestModal = document.getElementById('request-modal');
const requesterNameSpan = document.getElementById('requester-name');
const acceptBtn = document.getElementById('accept-btn');
const declineBtn = document.getElementById('decline-btn');
const chatStatus = document.getElementById('chat-status');
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const leaveChatBtn = document.getElementById('leave-chat-btn');
const locateBtn = document.getElementById('locate-btn');

// New Modals
const connectModal = document.getElementById('connect-modal');
const connectTargetNameSpan = document.getElementById('connect-target-name');
const connectConfirmBtn = document.getElementById('connect-confirm-btn');
const connectCancelBtn = document.getElementById('connect-cancel-btn');

const waitingModal = document.getElementById('waiting-modal');
const waitingTargetNameSpan = document.getElementById('waiting-target-name');
const waitingCancelBtn = document.getElementById('waiting-cancel-btn');

let pendingTargetID = null;

// Initialize Map
const map = L.map('map').setView([51.505, -0.09], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Attempt to locate immediately on load
startLocationTracking();

// Login
joinBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim();
    if (name) {
        myName = name;
        loginSection.classList.add('hidden');
        chatSection.classList.remove('hidden'); // Show chat section but in idle state
        chatStatus.textContent = `Logged in as ${myName}`;
        initWebSocket();

        // If we already have location, send it immediately
        if (myLat && myLon) {
            // We need to wait for WS connection, which is handled in onopen
        }
    }
});

locateBtn.addEventListener('click', () => {
    if (myLat && myLon) {
        map.setView([myLat, myLon], 16);
    } else {
        map.locate({ setView: true, maxZoom: 16 });
    }
});

function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws?id=${generateID()}`);

    ws.onopen = () => {
        console.log('Connected to server');
        send({ type: 'login', name: myName });
        if (myLat && myLon) {
            send({
                type: 'update_location',
                lat: myLat,
                lon: myLon
            });
        }
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
    };

    ws.onclose = () => {
        console.log('Disconnected');
        showToast('Disconnected from server. Please refresh.', 'error');
    };
}

function handleMessage(msg) {
    switch (msg.type) {
        case 'world_state':
            updateMap(msg.users);
            break;
        case 'chat_request':
            showRequestModal(msg);
            break;
        case 'chat_connected':
            startChat(msg);
            break;
        case 'request_cancelled':
            requestModal.classList.add('hidden');
            showToast('Chat request cancelled by sender.', 'info');
            break;
        case 'chat_declined':
            waitingModal.classList.add('hidden');
            showToast('Chat request declined.', 'info');
            break;
        case 'chat_msg':
            addMessage(msg.content, 'received');
            break;
        case 'partner_disconnected':
            // Legacy handler, but kept for safety
            endChat();
            showToast('Partner disconnected.', 'error');
            break;
        case 'chat_ended':
            endChat();
            showToast('Chat ended.', 'info');
            break;
    }
}

function updateMap(users) {
    // Remove markers for users who left
    const currentIDs = new Set(users.map(u => u.id));
    for (const id in markers) {
        if (!currentIDs.has(id)) {
            map.removeLayer(markers[id]);
            delete markers[id];
        }
    }

    // If we have a local marker and we are in the user list, remove local marker to avoid duplicates
    if (localMarker && currentIDs.has(myID)) {
        map.removeLayer(localMarker);
        localMarker = null;
    }

    let myUser = null;
    let partnerUser = null;

    users.forEach(user => {
        if (user.id === myID) {
            myUser = user;
        }

        if (user.id === partnerID) {
            partnerUser = user;
        }

        // Generate unique color for each user
        let color = stringToColor(user.id + user.name);

        // Status overrides color? Maybe outline or pulsing?
        // Let's keep the unique color but add status indicator
        let borderColor = 'white';
        if (user.status === 'requesting') borderColor = '#10b981'; // Green border
        if (user.status === 'chatting') borderColor = '#ef4444'; // Red border

        const icon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color:${color};width:14px;height:14px;border-radius:50%;border:3px solid ${borderColor};box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        if (markers[user.id]) {
            // Optimization: Only update if position changed significantly or status changed
            // For now, just update
            markers[user.id].setLatLng([user.lat, user.lon]);
            markers[user.id].setIcon(icon);
        } else {
            const marker = L.marker([user.lat, user.lon], { icon: icon }).addTo(map);

            // Only allow clicking on OTHERS
            if (user.id !== myID) {
                marker.on('click', () => {
                    if (!isChatting && user.status === 'idle') {
                        showConnectModal(user);
                    } else if (user.status !== 'idle') {
                        showToast(`${user.name} is currently busy.`, 'info');
                    }
                });
            }

            marker.bindTooltip(user.id === myID ? "You" : user.name, { permanent: false, direction: 'top' });
            markers[user.id] = marker;
        }
    });

    // Update connection line
    if (isChatting && myUser && partnerUser) {
        const latlngs = [
            [myUser.lat, myUser.lon],
            [partnerUser.lat, partnerUser.lon]
        ];
        if (connectionLine) {
            connectionLine.setLatLngs(latlngs);
        } else {
            connectionLine = L.polyline(latlngs, { color: 'red', weight: 3, dashArray: '10, 10', animate: true }).addTo(map);
        }
    } else {
        if (connectionLine) {
            map.removeLayer(connectionLine);
            connectionLine = null;
        }
    }
}

function startLocationTracking() {
    if ('geolocation' in navigator) {
        map.locate({ setView: true, maxZoom: 16, watch: true });

        map.on('locationfound', onLocationFound);
        map.on('locationerror', onLocationError);
    } else {
        alert('Geolocation not supported');
    }
}

function onLocationFound(e) {
    myLat = e.latlng.lat;
    myLon = e.latlng.lng;

    // Update local marker if not logged in yet
    if (!myName) {
        if (localMarker) {
            localMarker.setLatLng(e.latlng);
        } else {
            const icon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="background-color:#3b82f6;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            localMarker = L.marker(e.latlng, { icon: icon }).addTo(map);
            localMarker.bindTooltip("You (Offline)", { permanent: false, direction: 'top' });
        }
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
        send({
            type: 'update_location',
            lat: myLat,
            lon: myLon
        });
    }
}

function onLocationError(e) {
    console.error(e.message);
}

// Chat Request Logic
function showConnectModal(user) {
    pendingTargetID = user.id;
    connectTargetNameSpan.textContent = user.name;
    connectModal.classList.remove('hidden');
}

connectConfirmBtn.onclick = () => {
    if (pendingTargetID) {
        send({ type: 'request_chat', targetId: pendingTargetID });
        connectModal.classList.add('hidden');
        showWaitingModal(connectTargetNameSpan.textContent);
    }
};

connectCancelBtn.onclick = () => {
    connectModal.classList.add('hidden');
    pendingTargetID = null;
};

function showWaitingModal(targetName) {
    waitingTargetNameSpan.textContent = targetName;
    waitingModal.classList.remove('hidden');
}

waitingCancelBtn.onclick = () => {
    if (pendingTargetID) {
        send({ type: 'cancel_request', targetId: pendingTargetID });
    }
    waitingModal.classList.add('hidden');
    pendingTargetID = null;
};

function showRequestModal(msg) {
    requesterNameSpan.textContent = msg.fromName;
    requestModal.classList.remove('hidden');

    acceptBtn.onclick = () => {
        send({ type: 'accept_chat', requesterId: msg.fromId });
        requestModal.classList.add('hidden');
    };

    declineBtn.onclick = () => {
        send({ type: 'decline_chat', requesterId: msg.fromId });
        requestModal.classList.add('hidden');
    };
}

// Chat Logic
function startChat(msg) {
    isChatting = true;
    partnerID = msg.partnerId;

    // Hide any modals
    waitingModal.classList.add('hidden');
    connectModal.classList.add('hidden');
    requestModal.classList.add('hidden');

    chatStatus.textContent = `Chatting with ${msg.partnerName}`;
    leaveChatBtn.classList.remove('hidden');
    messageInput.disabled = false;
    messageInput.focus();
    messagesDiv.innerHTML = '';
    addMessage(`Connected with ${msg.partnerName}`, 'system');
}

function endChat(message) {
    console.log("Ending chat. Reason:", message);
    isChatting = false;
    partnerID = null;
    // If message is provided, show it. If not, show "Chat ended" as default for safety, or "Logged in..." if we want to reset.
    // User wants to see "User left", so we should stick to the message.
    chatStatus.textContent = message || `Chat ended`;
    leaveChatBtn.classList.add('hidden');
    messageInput.disabled = true;

    if (message) {
        addMessage(message, 'system');
    }

    if (connectionLine) {
        map.removeLayer(connectionLine);
        connectionLine = null;
    }
}

leaveChatBtn.addEventListener('click', () => {
    // Send end chat message instead of reloading
    send({ type: 'end_chat' });
});

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const content = messageInput.value.trim();
    if (content) {
        send({ type: 'chat_msg', content: content });
        addMessage(content, 'sent');
        messageInput.value = '';
    }
}

function addMessage(text, type) {
    const div = document.createElement('div');
    div.classList.add('message', type);
    div.textContent = text;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Utils
function send(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

function generateID() {
    myID = 'user_' + Math.random().toString(36).substr(2, 9);
    return myID;
}

function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Trigger reflow
    toast.offsetHeight;

    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            container.removeChild(toast);
        }, 300);
    }, 3000);
}

// Helper to generate color from string
function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i++) {
        let value = (hash >> (i * 8)) & 0xFF;
        color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
}
