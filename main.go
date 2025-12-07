package main

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

// UserStatus represents the current state of a user
type UserStatus string

const (
	StatusIdle       UserStatus = "idle"
	StatusRequesting UserStatus = "requesting"
	StatusChatting   UserStatus = "chatting"
)

// Client represents a connected user
type Client struct {
	ID        string     `json:"id"`
	Name      string     `json:"name"`
	Lat       float64    `json:"lat"`
	Lon       float64    `json:"lon"`
	Status    UserStatus `json:"status"`
	PartnerID string     `json:"partnerId,omitempty"`
	conn      *websocket.Conn
	send      chan []byte
	hub       *Hub
}

// Hub maintains the set of active clients and broadcasts messages
type Hub struct {
	clients    map[string]*Client
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

func newHub() *Hub {
	return &Hub{
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[string]*Client),
	}
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.ID] = client
			h.mu.Unlock()
			h.broadcastUserList()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.ID]; ok {
				// If chatting, notify partner
				if client.PartnerID != "" {
					if partner, ok := h.clients[client.PartnerID]; ok {
						partner.Status = StatusIdle
						partner.PartnerID = ""
						endMsg, _ := json.Marshal(map[string]interface{}{
							"type":    "chat_ended",
							"message": "Partner disconnected",
						})
						partner.send <- endMsg
					}
				}
				delete(h.clients, client.ID)
				close(client.send)
			}
			h.mu.Unlock()
			h.broadcastUserList()

		case message := <-h.broadcast:
			h.mu.RLock()
			for _, client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client.ID)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) broadcastUserList() {
	h.mu.RLock()
	defer h.mu.RUnlock()

	users := make([]map[string]interface{}, 0, len(h.clients))
	for _, client := range h.clients {
		users = append(users, map[string]interface{}{
			"id":        client.ID,
			"name":      client.Name,
			"lat":       client.Lat,
			"lon":       client.Lon,
			"status":    client.Status,
			"partnerId": client.PartnerID,
		})
	}

	msg, _ := json.Marshal(map[string]interface{}{
		"type":  "world_state",
		"users": users,
	})

	for _, client := range h.clients {
		select {
		case client.send <- msg:
		default:
		}
	}
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			break
		}

		var msg map[string]interface{}
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("error unmarshalling message: %v", err)
			continue
		}

		msgType, _ := msg["type"].(string)

		switch msgType {
		case "login":
			c.Name, _ = msg["name"].(string)
			c.hub.broadcastUserList()

		case "update_location":
			c.Lat, _ = msg["lat"].(float64)
			c.Lon, _ = msg["lon"].(float64)
			c.hub.broadcastUserList()

		case "request_chat":
			targetID, _ := msg["targetId"].(string)
			c.hub.mu.RLock()
			target, ok := c.hub.clients[targetID]
			c.hub.mu.RUnlock()

			if ok && target.Status == StatusIdle {
				c.Status = StatusRequesting
				// Notify target
				reqMsg, _ := json.Marshal(map[string]interface{}{
					"type":     "chat_request",
					"fromId":   c.ID,
					"fromName": c.Name,
				})
				target.send <- reqMsg
				c.hub.broadcastUserList()
			}

		case "accept_chat":
			requesterID, _ := msg["requesterId"].(string)
			c.hub.mu.Lock()
			requester, ok := c.hub.clients[requesterID]
			if ok && requester.Status == StatusRequesting {
				// Connect them
				c.Status = StatusChatting
				c.PartnerID = requester.ID
				requester.Status = StatusChatting
				requester.PartnerID = c.ID

				// Notify both
				connectedMsg, _ := json.Marshal(map[string]interface{}{
					"type":        "chat_connected",
					"partnerId":   requester.ID,
					"partnerName": requester.Name,
				})
				c.send <- connectedMsg

				connectedMsgReq, _ := json.Marshal(map[string]interface{}{
					"type":        "chat_connected",
					"partnerId":   c.ID,
					"partnerName": c.Name,
				})
				requester.send <- connectedMsgReq
			}
			c.hub.mu.Unlock()
			c.hub.broadcastUserList()

		case "decline_chat":
			requesterID, _ := msg["requesterId"].(string)
			c.hub.mu.RLock()
			requester, ok := c.hub.clients[requesterID]
			c.hub.mu.RUnlock()
			if ok {
				requester.Status = StatusIdle
				declineMsg, _ := json.Marshal(map[string]interface{}{
					"type": "chat_declined",
				})
				requester.send <- declineMsg
				c.hub.broadcastUserList()
			}

		case "cancel_request":
			targetID, _ := msg["targetId"].(string)
			c.hub.mu.RLock()
			target, ok := c.hub.clients[targetID]
			c.hub.mu.RUnlock()

			if ok {
				c.Status = StatusIdle
				cancelMsg, _ := json.Marshal(map[string]interface{}{
					"type": "request_cancelled",
				})
				target.send <- cancelMsg
				c.hub.broadcastUserList()
			} else {
				c.Status = StatusIdle
				c.hub.broadcastUserList()
			}

		case "chat_msg":
			content, _ := msg["content"].(string)
			if c.PartnerID != "" {
				c.hub.mu.RLock()
				partner, ok := c.hub.clients[c.PartnerID]
				c.hub.mu.RUnlock()
				if ok {
					forwardMsg, _ := json.Marshal(map[string]interface{}{
						"type":    "chat_msg",
						"content": content,
						"fromId":  c.ID,
					})
					partner.send <- forwardMsg
				}
			}

		case "end_chat":
			log.Printf("User %s (%s) requested end_chat. PartnerID: %s", c.Name, c.ID, c.PartnerID)
			c.hub.mu.Lock()
			if c.PartnerID != "" {
				if partner, ok := c.hub.clients[c.PartnerID]; ok {
					log.Printf("Found partner %s (%s). Sending chat_ended.", partner.Name, partner.ID)
					partner.Status = StatusIdle
					partner.PartnerID = ""
					endMsg, _ := json.Marshal(map[string]interface{}{
						"type":    "chat_ended",
						"message": c.Name + " left the chat",
					})
					partner.send <- endMsg
				} else {
					log.Printf("Partner ID %s not found in hub.", c.PartnerID)
				}
			} else {
				log.Printf("User %s has no PartnerID.", c.Name)
			}
			c.Status = StatusIdle
			c.PartnerID = ""
			c.hub.mu.Unlock()

			// Notify self as well to reset state
			endMsg, _ := json.Marshal(map[string]interface{}{
				"type":    "chat_ended",
				"message": "Chat ended",
			})
			c.send <- endMsg

			c.hub.broadcastUserList()
		}
	}
}

func (c *Client) writePump() {
	defer func() {
		c.conn.Close()
	}()
	for message := range c.send {
		if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
			return
		}
	}
}

func serveWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}

	// Generate a simple ID (in production use UUID)
	id := r.URL.Query().Get("id")
	if id == "" {
		id = "user_" + r.RemoteAddr // Fallback
	}

	client := &Client{
		ID:     id,
		hub:    hub,
		conn:   conn,
		send:   make(chan []byte, 256),
		Status: StatusIdle,
	}
	client.hub.register <- client

	go client.writePump()
	go client.readPump()
}

func main() {
	hub := newHub()
	go hub.run()

	// Serve static files from web/dist
	fs := http.FileServer(http.Dir("./web/dist"))
	http.Handle("/", fs)

	// WebSocket endpoint
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWs(hub, w, r)
	})

	log.Println("Server started on :8080")
	log.Println("Visit http://localhost:8080 in your browser")
	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
