// Require the packages we will use:
const http = require("http"),
    fs = require("fs");

const port = 3456;
const file = "client.html";
// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html, on port 3456:
const server = http.createServer(function (req, res) {
    // This callback runs when a new connection is made to our HTTP server.

    fs.readFile(file, function (err, data) {
        // This callback runs when the client.html file has been read from the filesystem.

        if (err) return res.writeHead(500);
        res.writeHead(200);
        res.end(data);
    });
});
server.listen(port);

// Import Socket.IO and pass our HTTP server object to it.
const socketio = require("socket.io")(http, {
    wsEngine: 'ws'
});

// store rooms
let rooms = [];

// see if a room exists
function roomExists(roomName) {
    let exists = false;
    rooms.forEach(room =>{
        if(room === roomName){
            exists = true;
        }
    });
    return exists;
}

// add a new room
function addRoom(roomName) {
    if(!roomExists(roomName)){
        rooms.push(roomName);
    }
}

// Attach our Socket.IO server to our HTTP server to listen
const io = socketio.listen(server);
io.sockets.on("connection", function (socket) {
    // This callback runs when a new Socket.IO connection is established.

    socket.on('join_room', function (data){
        let {username, roomName, is_private, roomPassword} = data
        socket.join(roomName);
        
        socket.to(roomName).emit('message_to_client', { message: `${username} has joined the room.` });
        io.to(roomName).emit('room_users', { users: Object.keys(io.sockets.adapter.rooms[roomName].sockets)});
    })

    socket.on('message_to_server', function (data) {
        // This callback runs when the server receives a new message from the client.
        let {roomName, message } = data;
        console.log("message: " + data["message"]); // log it to the Node.JS output
        io.to(roomName).emit("message_to_client", { message: message }) // broadcast the message to other users
    });
});